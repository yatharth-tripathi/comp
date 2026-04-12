import { QuickCaptureForm } from "@/components/leads/quick-capture-form";

export const metadata = { title: "Quick capture — New lead" };

export default function NewLeadPage(): JSX.Element {
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Quick capture</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Name + phone is enough. Everything else can come later — you have
          10 seconds between customers in the field.
        </p>
      </div>
      <QuickCaptureForm />
    </div>
  );
}
