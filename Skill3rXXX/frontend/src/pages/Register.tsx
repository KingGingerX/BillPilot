import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "react-router-dom";
import { useRegister } from "../hooks/useAuth";

const RegisterSchema = z.object({
  firstName: z.string().min(1, "Required"),
  lastName:  z.string().min(1, "Required"),
  email:     z.string().email("Invalid email"),
  password:  z.string()
    .min(8, "At least 8 characters")
    .regex(/[A-Z]/, "Must contain uppercase")
    .regex(/[0-9]/, "Must contain number"),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});
type RegisterForm = z.infer<typeof RegisterSchema>;

export default function RegisterPage() {
  const { mutate: register, isPending } = useRegister();

  const {
    register: reg,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterForm>({ resolver: zodResolver(RegisterSchema) });

  const onSubmit = (data: RegisterForm) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { confirmPassword, ...rest } = data;
    register(rest);
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-white mb-6">Create your account</h2>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">First name</label>
            <input className="input" placeholder="Jane" {...reg("firstName")} />
            {errors.firstName && <p className="text-red-400 text-xs mt-1">{errors.firstName.message}</p>}
          </div>
          <div>
            <label className="label">Last name</label>
            <input className="input" placeholder="Doe" {...reg("lastName")} />
            {errors.lastName && <p className="text-red-400 text-xs mt-1">{errors.lastName.message}</p>}
          </div>
        </div>

        <div>
          <label className="label">Email</label>
          <input type="email" className="input" placeholder="you@example.com" autoComplete="email" {...reg("email")} />
          {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
        </div>

        <div>
          <label className="label">Password</label>
          <input type="password" className="input" placeholder="Min 8 chars, 1 uppercase, 1 number" {...reg("password")} />
          {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
        </div>

        <div>
          <label className="label">Confirm password</label>
          <input type="password" className="input" placeholder="••••••••" {...reg("confirmPassword")} />
          {errors.confirmPassword && <p className="text-red-400 text-xs mt-1">{errors.confirmPassword.message}</p>}
        </div>

        <button type="submit" className="btn-primary w-full mt-2" disabled={isPending}>
          {isPending ? "Creating account..." : "Create account — it's free"}
        </button>
      </form>

      <p className="text-center text-sm text-gray-400 mt-6">
        Already have an account?{" "}
        <Link to="/login" className="text-brand-400 hover:underline font-medium">Sign in</Link>
      </p>
    </div>
  );
}
