/**
 * useAuth — React hook wrapping auth API calls with loading/error state.
 */
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { authApi } from "../api/client";
import { useAuthStore } from "../store";

export function useLogin() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  return useMutation({
    mutationFn: (data: { email: string; password: string }) => authApi.login(data),
    onSuccess: ({ data }) => {
      login(data.data.user, data.data.tokens.accessToken, data.data.tokens.refreshToken);
      toast.success(`Welcome back, ${data.data.user.firstName}!`);
      navigate("/dashboard");
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message ?? "Login failed");
    },
  });
}

export function useRegister() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  return useMutation({
    mutationFn: (data: object) => authApi.register(data),
    onSuccess: ({ data }) => {
      login(data.data.user, data.data.tokens.accessToken, data.data.tokens.refreshToken);
      toast.success("Account created! Welcome to PIMS 🚀");
      navigate("/dashboard");
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message ?? "Registration failed");
    },
  });
}

export function useLogout() {
  const navigate = useNavigate();
  const { refreshToken, logout } = useAuthStore();

  return () => {
    void authApi.logout(refreshToken ?? "").catch(() => {});
    logout();
    navigate("/login");
    toast.success("Logged out successfully");
  };
}

export function useMe() {
  const isAuth = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: ["me"],
    queryFn: () => authApi.me().then((r) => r.data.data),
    enabled: isAuth,
    staleTime: 5 * 60 * 1000,
  });
}
