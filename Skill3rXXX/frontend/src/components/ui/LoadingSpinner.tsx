export default function LoadingSpinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizeMap = { sm: "w-4 h-4", md: "w-8 h-8", lg: "w-12 h-12" };
  return (
    <div className="flex items-center justify-center p-8">
      <div
        className={`${sizeMap[size]} border-2 border-gray-700 border-t-brand-500 rounded-full animate-spin`}
      />
    </div>
  );
}
