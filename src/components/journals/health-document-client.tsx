"use client";

import { StaffJournalToolbar } from "@/components/journals/staff-journal-toolbar";
import {
  HEALTH_REGISTER_NOTES,
  HEALTH_REGISTER_REMINDER,
  buildDateKeys,
  buildHygieneExampleEmployees,
  formatMonthLabel,
  getDayNumber,
  getHygienePositionLabel,
  getWeekdayShort,
  normalizeHealthEntryData,
  type HealthEntryData,
} from "@/lib/hygiene-document";

type Props = {
  documentId: string;
  title: string;
  organizationName: string;
  dateFrom: string;
  dateTo: string;
  responsibleTitle: string | null;
  status: string;
  autoFill?: boolean;
  employees: { id: string; name: string; role: string }[];
  initialEntries: { employeeId: string; date: string; data: HealthEntryData }[];
};

function HealthCheckbox() {
  return (
    <div
      aria-hidden="true"
      className="health-checkbox mx-auto h-6 w-6 rounded-[5px] border border-[#c8ccda] bg-white"
    />
  );
}

function HealthHeader({
  organizationLabel,
  pageLabel,
}: {
  organizationLabel: string;
  pageLabel: string;
}) {
  return (
    <table className="health-header w-full border-collapse">
      <tbody>
        <tr>
          <td
            rowSpan={2}
            className="w-[270px] border border-black px-8 py-8 text-center text-[22px] font-semibold"
          >
            {organizationLabel}
          </td>
          <td className="border border-black px-8 py-4 text-center text-[18px] uppercase">
            СИСТЕМА ХАССП
          </td>
          <td
            rowSpan={2}
            className="w-[170px] border border-black px-8 py-8 text-center text-[18px] uppercase"
          >
            {pageLabel}
          </td>
        </tr>
        <tr>
          <td className="border border-black px-8 py-4 text-center text-[17px] italic uppercase">
            ЖУРНАЛ ЗДОРОВЬЯ
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function makeCellKey(employeeId: string, dateKey: string) {
  return `${employeeId}:${dateKey}`;
}

function getHealthMeasures(
  employeeId: string,
  dateKeys: string[],
  entryMap: Record<string, HealthEntryData>
) {
  return dateKeys.flatMap((dateKey) => {
    const measures = entryMap[makeCellKey(employeeId, dateKey)]?.measures?.trim();
    if (!measures) return [];

    return [`${getDayNumber(dateKey)} ${getWeekdayShort(dateKey)}. - ${measures}`];
  });
}

export function HealthDocumentClient(props: Props) {
  const {
    documentId,
    title,
    organizationName,
    dateFrom,
    dateTo,
    status,
    autoFill = false,
    employees,
    initialEntries,
  } = props;

  const dateKeys = buildDateKeys(dateFrom, dateTo);
  const includedEmployeeIds = [...new Set(initialEntries.map((entry) => entry.employeeId))];
  const rosterUsers = employees.filter((employee) => includedEmployeeIds.includes(employee.id));
  const printableEmployees = buildHygieneExampleEmployees(rosterUsers, 5);
  const monthLabel = formatMonthLabel(dateFrom, dateTo);
  const organizationLabel = organizationName || 'ООО "Тест"';
  const documentTitle = title || "Журнал здоровья";
  const entryMap: Record<string, HealthEntryData> = {};

  initialEntries.forEach((entry) => {
    entryMap[makeCellKey(entry.employeeId, entry.date)] = normalizeHealthEntryData(entry.data);
  });

  return (
    <div className="bg-white text-black">
      <style jsx global>{`
        @page {
          size: A4 landscape;
          margin: 10mm;
        }

        @media print {
          html,
          body {
            background: #ffffff !important;
          }

          body {
            margin: 0;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .screen-only {
            display: none !important;
          }

          .health-sheet {
            width: 100%;
            max-width: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          .health-grid {
            width: 100% !important;
            min-width: 0 !important;
            table-layout: fixed;
          }

          .health-grid th,
          .health-grid td {
            font-size: 10px !important;
            line-height: 1.1 !important;
            padding: 4px 3px !important;
          }

          .health-header td {
            font-size: 11px !important;
            line-height: 1.15 !important;
            padding: 8px 10px !important;
          }

          .health-title {
            font-size: 24px !important;
            margin-bottom: 24px !important;
          }

          .health-notes {
            font-size: 10px !important;
            line-height: 1.25 !important;
            margin-top: 24px !important;
          }

          .health-checkbox {
            width: 10px !important;
            height: 10px !important;
            border-radius: 2px !important;
          }
        }
      `}</style>

      <div className="health-sheet mx-auto max-w-[1720px] px-8 py-6">
        <div className="screen-only mb-10 space-y-10">
          <StaffJournalToolbar
            documentId={documentId}
            heading="Журнал здоровья"
            title={documentTitle}
            status={status}
            autoFill={autoFill}
            responsibleTitle={props.responsibleTitle}
            users={employees}
            includedEmployeeIds={includedEmployeeIds}
          />
        </div>

        <div className="mx-auto max-w-[1860px]">
          <div className="mb-10">
            <HealthHeader organizationLabel={organizationLabel} pageLabel="СТР. 1 ИЗ 1" />
          </div>

          <div className="health-title mb-8 text-center text-[34px] font-bold uppercase">
            {documentTitle}
          </div>

          <table className="health-grid w-full border-collapse text-[15px]">
            <thead>
              <tr className="bg-[#f2f2f2]">
                <th
                  className="w-[42px] border border-black p-2 text-center font-semibold"
                  rowSpan={2}
                >
                  <HealthCheckbox />
                </th>
                <th
                  className="w-[72px] border border-black p-2 text-center font-semibold"
                  rowSpan={2}
                >
                  №
                  <br />
                  п/п
                </th>
                <th
                  className="w-[230px] border border-black p-2 text-center font-semibold"
                  rowSpan={2}
                >
                  Ф.И.О. работника
                </th>
                <th
                  className="w-[270px] border border-black p-2 text-center font-semibold"
                  rowSpan={2}
                >
                  Должность
                </th>
                <th
                  className="border border-black p-2 text-center text-[16px] font-semibold"
                  colSpan={dateKeys.length}
                >
                  Месяц {monthLabel}
                </th>
                <th
                  className="w-[200px] border border-black p-2 text-center font-semibold"
                  rowSpan={2}
                >
                  Принятые меры
                </th>
              </tr>
              <tr className="bg-[#f2f2f2]">
                {dateKeys.map((dateKey) => (
                  <th
                    key={dateKey}
                    className="w-[58px] border border-black p-2 text-center font-semibold"
                  >
                    <div>{getDayNumber(dateKey)}</div>
                    <div>{getWeekdayShort(dateKey)}.</div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {printableEmployees.map((employee) => {
                const measures = getHealthMeasures(employee.id, dateKeys, entryMap);

                return (
                  <tr key={employee.id}>
                    <td className="border border-black p-2 text-center align-middle">
                      <HealthCheckbox />
                    </td>
                    <td className="border border-black p-2 text-center align-middle">
                      {employee.name ? employee.number : ""}
                    </td>
                    <td className="border border-black p-2 text-center align-middle">
                      {employee.name || ""}
                    </td>
                    <td className="border border-black p-2 text-center align-middle">
                      {employee.name
                        ? employee.position || getHygienePositionLabel("operator")
                        : ""}
                    </td>
                    {dateKeys.map((dateKey) => {
                      const data = entryMap[makeCellKey(employee.id, dateKey)];

                      return (
                        <td
                          key={`${employee.id}:${dateKey}`}
                          className="border border-black p-2 text-center align-middle"
                        >
                          {data?.signed ? "+" : ""}
                        </td>
                      );
                    })}
                    <td className="border border-black px-3 py-2 align-middle">
                      <div className="space-y-1 text-left text-[14px] leading-5">
                        {measures.map((item) => (
                          <div key={`${employee.id}:${item}`}>{item}</div>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}

              <tr>
                <td className="border border-black p-2 text-center align-middle">
                  <HealthCheckbox />
                </td>
                <td className="border border-black p-2 text-center" />
                <td className="border border-black p-2 text-center" />
                <td className="border border-black p-2 text-center" />
                {dateKeys.map((dateKey) => (
                  <td key={`blank:${dateKey}`} className="border border-black p-2" />
                ))}
                <td className="border border-black p-2" />
              </tr>
            </tbody>
          </table>

          <div className="health-notes mt-12 space-y-7 text-[16px] leading-7">
            {HEALTH_REGISTER_NOTES.map((note) => (
              <p key={note}>{note}</p>
            ))}
            <p className="font-semibold">{HEALTH_REGISTER_REMINDER}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
