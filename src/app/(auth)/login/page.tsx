import LoginClient from "./login-client";

export const metadata = {
  title: "Вход в кабинет",
  description:
    "Вход в личный кабинет WeSetup. Электронные журналы СанПиН и ХАССП для общепита и пищевых производств.",
  alternates: { canonical: "https://wesetup.ru/login" },
};

export default function LoginPage() {
  return <LoginClient />;
}
