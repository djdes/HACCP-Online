import RegisterClient from "./register-client";

export const metadata = {
  title: "Регистрация организации",
  description:
    "Создайте бесплатный аккаунт WeSetup за 5 минут. До 5 сотрудников бесплатно навсегда. Все 35 электронных журналов СанПиН и ХАССП включены.",
  alternates: { canonical: "https://wesetup.ru/register" },
};

export default function RegisterPage() {
  return <RegisterClient />;
}
