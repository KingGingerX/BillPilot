/**
 * Content page — schedule and AI-generate content across platforms.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { contentApi } from "../api/client";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import { format } from "date-fns";

const PLATFORMS = ["BLOG", "TWITTER", "FACEBOOK", "INSTAGRAM", "PINTEREST", "EMAIL", "LINKEDIN"] as const;
const TONES = ["professional", "casual", "educational", "promotional"] as const;

const GenerateSchema = z.object({
  topic: z.string().min(3, "Topic must be at least 3 characters"),
  platform: z.enum(PLATFORMS),
  tone: z.enum(TONES),
  keywords: z.string().optional(),
  includeAffiliateCta: z.boolean().default(false),
});
type GenerateForm = z.infer<typeof GenerateSchema>;

const STATUS_BADGE: Record<string, string> = {
  PUBLISHED: "badge-green",
  SCHEDULED: "badge-blue",
  DRAFT:     "badge-gray",
  FAILED:    "badge-red",
};

export default function ContentPage() {
  const qc = useQueryClient();
  const [showGenerate, setShowGenerate] = useState(false);

  const { data: posts, isLoading } = useQuery({
    queryKey: ["content"],
    queryFn: () => contentApi.list().then((r) => r.data.data),
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<GenerateForm>({ resolver: zodResolver(GenerateSchema) });

  const generateMutation = useMutation({
    mutationFn: (data: GenerateForm) =>
      contentApi.generate({
        ...data,
        keywords: data.keywords ? data.keywords.split(",").map((k) => k.trim()) : [],
      }),
    onSuccess: () => {
      toast.success("Content generated! Review it in the list below.");
      qc.invalidateQueries({ queryKey: ["content"] });
      reset();
      setShowGenerate(false);
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      toast.error(err.response?.data?.message ?? "Generation failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => contentApi.delete(id),
    onSuccess: () => {
      toast.success("Post deleted");
      qc.invalidateQueries({ queryKey: ["content"] });
    },
  });

  if (isLoading) return <LoadingSpinner size="lg" />;

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Content Automation</h2>
          <p className="text-gray-400 mt-1">AI-generate and schedule content across all platforms</p>
        </div>
        <button className="btn-primary" onClick={() => setShowGenerate(!showGenerate)}>
          {showGenerate ? "Cancel" : "✨ Generate Content"}
        </button>
      </div>

      {/* AI generate form */}
      {showGenerate && (
        <div className="card border-purple-500/30 bg-purple-500/5 animate-slide-up">
          <h3 className="font-semibold text-white mb-4">✨ AI Content Generator</h3>
          <form onSubmit={handleSubmit((d) => generateMutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Topic / Subject</label>
                <input
                  className="input"
                  placeholder="e.g. How to make $1000/month with affiliate marketing"
                  {...register("topic")}
                />
                {errors.topic && <p className="text-red-400 text-xs mt-1">{errors.topic.message}</p>}
              </div>
              <div>
                <label className="label">Platform</label>
                <select className="input" {...register("platform")}>
                  {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Tone</label>
                <select className="input" {...register("tone")}>
                  {TONES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Keywords (comma-separated)</label>
                <input
                  className="input"
                  placeholder="passive income, affiliate marketing, side hustle"
                  {...register("keywords")}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="cta" {...register("includeAffiliateCta")} />
              <label htmlFor="cta" className="text-sm text-gray-300">
                Include affiliate call-to-action
              </label>
            </div>
            <button
              type="submit"
              className="btn-primary"
              disabled={generateMutation.isPending}
            >
              {generateMutation.isPending ? "Generating..." : "Generate with AI →"}
            </button>
          </form>
        </div>
      )}

      {/* Posts list */}
      <div className="space-y-3">
        {posts?.length === 0 && (
          <div className="card text-center py-12">
            <p className="text-4xl mb-3">✍️</p>
            <p className="text-gray-400">No content yet. Generate your first post above!</p>
          </div>
        )}

        {posts?.map((post: {
          id: string; title: string; platform: string; status: string;
          aiGenerated: boolean; createdAt: string; scheduledAt?: string;
          body: string;
        }) => (
          <div key={post.id} className="card hover:border-gray-700 transition-colors">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className={STATUS_BADGE[post.status] ?? "badge-gray"}>{post.status}</span>
                  <span className="badge badge-blue">{post.platform}</span>
                  {post.aiGenerated && <span className="badge bg-purple-900/50 text-purple-400 border border-purple-800">✨ AI</span>}
                </div>
                <h3 className="font-medium text-white truncate">{post.title}</h3>
                <p className="text-sm text-gray-400 line-clamp-2 mt-1">{post.body}</p>
                <p className="text-xs text-gray-500 mt-2">
                  Created {format(new Date(post.createdAt), "MMM d, yyyy")}
                  {post.scheduledAt && (
                    <span className="ml-2">· Scheduled {format(new Date(post.scheduledAt), "MMM d, HH:mm")}</span>
                  )}
                </p>
              </div>
              <button
                className="text-gray-600 hover:text-red-400 transition-colors flex-shrink-0"
                onClick={() => {
                  if (confirm("Delete this post?")) deleteMutation.mutate(post.id);
                }}
              >
                🗑️
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
