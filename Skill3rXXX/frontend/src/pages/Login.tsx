/**
 * Login page — email/password form with react-hook-form + Zod validation.
 */
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "react-router-dom";
import { useLogin } from "../hooks/useAuth";

const LoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});
type LoginForm = z.infer<typeof LoginSchema>;

export default function LoginPage() {
  const { mutate: login, isPending } = useLogin();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(LoginSchema) });

  return (
    <div>
      <h2 className="text-xl font-bold text-white mb-6">Sign in to your account</h2>

      <form onSubmit={handleSubmit((d) => login(d))} className="space-y-4">
        <div>
          <label className="label">Email address</label>
          <input
            type="email"
            className="input"
            placeholder="you@example.com"
            autoComplete="email"
            {...register("email")}
          />
          {errors.email && (
            <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="label !mb-0">Password</label>
            <Link to="/forgot-password" className="text-xs text-brand-400 hover:underline">
              Forgot password?
            </Link>
          </div>
          <input
            type="password"
            className="input"
            placeholder="••••••••"
            autoComplete="current-password"
            {...register("password")}
          />
          {errors.password && (
            <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>
          )}
        </div>

        <button type="submit" className="btn-primary w-full mt-2" disabled={isPending}>
          {isPending ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <p className="text-center text-sm text-gray-400 mt-6">
        Don't have an account?{" "}
        <Link to="/register" className="text-brand-400 hover:underline font-medium">
          Create one free
        </Link>
      </p>
    </div>
  );
}
