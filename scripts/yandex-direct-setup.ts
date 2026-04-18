/**
 * Create campaigns / adgroups / ads / keywords from src/content/direct-campaigns.ts.
 *
 * Safety first:
 *   - Campaigns are created with StartDate in the future and `DailyBudget`
 *     set from the spec — Direct doesn't have a first-class DRAFT state
 *     for TextCampaign, so right after create we call `campaigns.suspend`
 *     to pause them. Nothing runs until the user resumes.
 *   - --dry-run: prints the JSON payload without calling the API.
 *   - Idempotent via spec.slug → if a campaign with the same Name exists
 *     the script skips it and prints a warning.
 *
 * Usage:
 *   npx tsx scripts/yandex-direct-setup.ts --dry-run   # preview
 *   npx tsx scripts/yandex-direct-setup.ts             # really create (paused)
 */

import "dotenv/config";
import { YandexDirectClient } from "../src/lib/yandex-direct";
import { CAMPAIGNS } from "../src/content/direct-campaigns";

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  const client = new YandexDirectClient();

  // Sanity: fetch balance first. If the account isn't funded, every
  // "add" call will return 8000 / "Insufficient funds" — better to fail
  // early with a clear message.
  if (!DRY_RUN) {
    try {
      const balance = await client.getClientBalance();
      const b = balance.Clients?.[0];
      console.log(
        `Аккаунт: ${b?.Login ?? "?"}, баланс: ${b?.AccountBalance ?? "?"} ${b?.Currency ?? ""}`
      );
    } catch (err) {
      console.warn(
        "Не удалось прочитать баланс — продолжаем, но проверьте scope токена:",
        (err as Error).message
      );
    }
  }

  // Fetch existing campaigns once for idempotency.
  const existing = DRY_RUN
    ? { Campaigns: [] as Array<{ Id?: number; Name?: string }> }
    : await client.listCampaigns({});
  const existingNames = new Set(
    (existing.Campaigns ?? []).map((c) => c.Name as string | undefined).filter(Boolean)
  );

  let createdCampaigns = 0;
  let createdGroups = 0;
  let createdAds = 0;
  let createdKeywords = 0;

  const startDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  })();

  for (const spec of CAMPAIGNS) {
    if (existingNames.has(spec.name)) {
      console.log(`[skip] «${spec.name}» уже существует — пропускаю.`);
      continue;
    }

    const campaignPayload = {
      Name: spec.name,
      StartDate: startDate,
      DailyBudget: {
        Amount: spec.dailyBudgetRub * 1_000_000, // Direct считает в микро-рублях
        Mode: "STANDARD",
      },
      TextCampaign: {
        BiddingStrategy: {
          Search: { BiddingStrategyType: "HIGHEST_POSITION" },
          Network: { BiddingStrategyType: "SERVING_OFF" },
        },
        Settings: [
          { Option: "REQUIRE_SERVICING", Value: "NO" },
          { Option: "ENABLE_CPC_HOLD", Value: "YES" },
        ],
      },
      NegativeKeywords: {
        Items: spec.negativeKeywords,
      },
    };

    if (DRY_RUN) {
      console.log(
        `\n[dry-run] campaigns.add →`,
        JSON.stringify(campaignPayload, null, 2)
      );
      for (const group of spec.adGroups) {
        console.log(`  [dry-run] adgroup «${group.name}»: ${group.keywords.length} key, ${group.ads.length} ads`);
      }
      continue;
    }

    const camp = await client.createCampaigns([campaignPayload]);
    const campId = camp.AddResults?.[0]?.Id;
    if (!campId) {
      console.error(
        `Не удалось создать кампанию «${spec.name}»:`,
        JSON.stringify(camp, null, 2)
      );
      continue;
    }
    createdCampaigns += 1;
    console.log(`[create] «${spec.name}» id=${campId}`);

    // Pause immediately so nothing runs without human approval.
    await client.suspendCampaigns([campId]);
    console.log(`  [pause] id=${campId} поставлена на паузу`);

    for (const group of spec.adGroups) {
      const groupRes = await client.createAdGroups([
        {
          Name: group.name,
          CampaignId: campId,
          RegionIds: [225], // Россия целиком — потом сузим по отчёту
          Type: "TEXT_AD_GROUP",
        },
      ]);
      const groupId = groupRes.AddResults?.[0]?.Id;
      if (!groupId) {
        console.error(
          `Не удалось создать группу «${group.name}»:`,
          JSON.stringify(groupRes, null, 2)
        );
        continue;
      }
      createdGroups += 1;

      // Ads — up to 50 per adgroup; we have ≤3 per spec.
      const ads = group.ads.map((ad) => ({
        AdGroupId: groupId,
        TextAd: {
          Title: ad.title1,
          Title2: ad.title2,
          Text: ad.text,
          Mobile: "NO",
          Href: ad.href,
          DisplayUrlPath: ad.displayPath,
        },
      }));
      const adsRes = await client.createAds(ads);
      createdAds += adsRes.AddResults?.filter((r) => r.Id).length ?? 0;

      // Keywords — one per phrase, with maxbid left to strategy.
      const keywords = group.keywords.map((kw) => ({
        AdGroupId: groupId,
        Keyword: kw,
      }));
      const kwRes = await client.createKeywords(keywords);
      createdKeywords += kwRes.AddResults?.filter((r) => r.Id).length ?? 0;

      console.log(
        `  [group] «${group.name}»: ads=${ads.length}, keywords=${keywords.length}`
      );
    }
  }

  console.log(
    `\nГотово. Создано: кампаний=${createdCampaigns}, групп=${createdGroups}, объявлений=${createdAds}, ключей=${createdKeywords}`
  );
  if (!DRY_RUN && createdCampaigns > 0) {
    console.log(
      "\nВсе кампании на паузе. Проверьте в direct.yandex.ru и запустите вручную после модерации."
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
