interface LoginHeaderProps {
  title?: string;
  subtitle?: string;
  logoSrc?: string;
  logoAlt?: string;
}

export default function LoginHeader({
  title = "Login to @Cloud",
  subtitle = "Welcome back to @Cloud Marketplace Ministry",
  logoSrc = "/Cloud-removebg.png",
  logoAlt = "@Cloud Logo",
}: LoginHeaderProps) {
  return (
    <div>
      <div className="flex justify-center">
        <img className="h-16 w-auto" src={logoSrc} alt={logoAlt} />
      </div>
      <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
        {title}
      </h2>
      <p className="mt-2 text-center text-sm text-gray-600">{subtitle}</p>
    </div>
  );
}
