import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Ошибка входа | Freelanly',
  description: 'Произошла ошибка при входе',
};

interface ErrorPageProps {
  searchParams: Promise<{
    error?: string;
  }>;
}

const errorMessages: Record<string, string> = {
  Configuration: 'Ошибка конфигурации сервера. Обратитесь в поддержку.',
  AccessDenied: 'Доступ запрещён.',
  Verification: 'Ссылка для входа истекла или уже использована.',
  OAuthSignin: 'Ошибка при входе через Google. Попробуйте снова.',
  OAuthCallback: 'Ошибка при входе через Google. Попробуйте снова.',
  OAuthCreateAccount: 'Не удалось создать аккаунт. Попробуйте другой способ входа.',
  EmailCreateAccount: 'Не удалось создать аккаунт. Попробуйте снова.',
  Callback: 'Ошибка при входе. Попробуйте снова.',
  OAuthAccountNotLinked:
    'Этот email уже используется с другим способом входа. Войдите тем способом, которым регистрировались.',
  EmailSignin: 'Не удалось отправить письмо. Проверьте email и попробуйте снова.',
  CredentialsSignin: 'Неверный email или пароль.',
  SessionRequired: 'Войдите, чтобы получить доступ к этой странице.',
  Default: 'Произошла ошибка. Попробуйте снова.',
};

export default async function AuthErrorPage({ searchParams }: ErrorPageProps) {
  const params = await searchParams;
  const error = params.error || 'Default';
  const errorMessage = errorMessages[error] || errorMessages.Default;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="max-w-md w-full text-center">
        {/* Logo */}
        <a href="/" className="text-3xl font-bold text-black">
          Freelanly
        </a>

        {/* Error icon */}
        <div className="mt-8 w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto">
          <svg
            className="w-10 h-10 text-red-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        <h1 className="mt-6 text-2xl font-semibold text-gray-900">
          Ошибка входа
        </h1>

        <p className="mt-4 text-gray-600">{errorMessage}</p>

        <div className="mt-8 flex flex-col gap-3">
          <a
            href="/auth/signin"
            className="inline-block px-6 py-3 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
          >
            Попробовать снова
          </a>
          <a
            href="/"
            className="inline-block text-gray-500 hover:text-gray-700 text-sm"
          >
            ← Вернуться на главную
          </a>
        </div>
      </div>
    </div>
  );
}
