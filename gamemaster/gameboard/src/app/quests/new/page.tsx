import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { calculateFee } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const questTypes = ["SERVICE", "CHALLENGE", "ITEM", "BET", "EXPERIENCE"];

export default async function NewQuestPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const feeConfig = await prisma.feeConfig.findFirst();
  const rakePercent = feeConfig?.rakePercent ?? 10;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle className="text-2xl">Post a New Quest</CardTitle>
          <CardDescription>
            Set the rules. Name the price. Let players come to you.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            action={async (formData) => {
              "use server";
              const session = await auth();
              if (!session) redirect("/login");

              const title = formData.get("title") as string;
              const description = formData.get("description") as string;
              const type = formData.get("type") as string;
              const category = formData.get("category") as string;
              const price = Math.round(parseFloat(formData.get("price") as string) * 100);
              const maxSlots = parseInt(formData.get("maxSlots") as string) || 1;
              const deadlineStr = formData.get("deadline") as string;
              const rules = formData.get("rules") as string;
              const promoted = formData.get("promoted") as string;

              const feeConfig = await prisma.feeConfig.findFirst();
              const rake = feeConfig?.rakePercent ?? 10;
              const { fee } = calculateFee(price, rake);

              const promotionLevel =
                promoted === "FEATURED"
                  ? "FEATURED"
                  : promoted === "HIGHLIGHTED"
                  ? "HIGHLIGHTED"
                  : "NONE";

              const quest = await prisma.quest.create({
                data: {
                  title,
                  description,
                  type: type as any,
                  category: category || "General",
                  price,
                  feeAmount: fee,
                  maxSlots,
                  filledSlots: 0,
                  promoted: promotionLevel as any,
                  rules,
                  creatorId: session.user.id,
                  deadline: deadlineStr ? new Date(deadlineStr) : null,
                },
              });

              await prisma.user.update({
                where: { id: session.user.id },
                data: { questsCreated: { increment: 1 }, xp: { increment: 10 } },
              });

              redirect(`/quests/${quest.id}`);
            }}
            className="space-y-5"
          >
            <div className="space-y-2">
              <Label htmlFor="title">Quest Title</Label>
              <Input
                id="title"
                name="title"
                placeholder="e.g., Beat my Dark Souls speedrun"
                required
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="type">Quest Type</Label>
                <Select id="type" name="type" required>
                  {questTypes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  name="category"
                  placeholder="e.g., Gaming, Fitness, Design"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="Describe exactly what the quest is..."
                rows={4}
                required
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="price">Price (USD)</Label>
                <Input
                  id="price"
                  name="price"
                  type="number"
                  min="1"
                  step="0.01"
                  placeholder="50.00"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  House rake: {rakePercent}% — you keep {100 - rakePercent}%.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxSlots">Max Slots</Label>
                <Input
                  id="maxSlots"
                  name="maxSlots"
                  type="number"
                  min="1"
                  defaultValue="1"
                  required
                />
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="deadline">Deadline (optional)</Label>
                <Input id="deadline" name="deadline" type="datetime-local" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="promoted">Promotion</Label>
                <Select id="promoted" name="promoted">
                  <option value="NONE">None — free</option>
                  <option value="FEATURED">Featured — $5</option>
                  <option value="HIGHLIGHTED">Highlighted — $15</option>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rules">Rules / Requirements</Label>
              <Textarea
                id="rules"
                name="rules"
                placeholder="How will completion be verified? Any special rules?"
                rows={3}
              />
            </div>

            <Button type="submit" className="w-full bg-primary hover:bg-primary/90">
              Publish Quest
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
