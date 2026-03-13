export const dynamic = "force-dynamic";

export default function BotEmbedPage() {
  const src = "https://dashboard.ngtdashboard.com/dashboard?theme=stealth";

  return (
    <div className="relative -mx-4 -mt-4 sm:-mx-5 sm:-mt-5 xl:-mx-6 xl:-mt-6">
      <iframe
        src={src}
        className="w-full"
        style={{
          height: "calc(100vh - 72px)",
          border: "0",
          display: "block",
          background: "transparent",
        }}
        allow="clipboard-read; clipboard-write"
      />
    </div>
  );
}
