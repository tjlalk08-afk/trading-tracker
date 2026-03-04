export const dynamic = "force-dynamic";

export default function BotEmbedPage() {
  const src = "https://dashboard.ngtdashboard.com/dashboard?theme=stealth";

  return (
    <div className="relative -mx-12 -mt-10">
      <iframe
        src={src}
        className="w-full"
        style={{
          height: "calc(100vh - 88px)", // adjust if you want more/less height
          border: "0",
          display: "block",
          background: "transparent",
        }}
        allow="clipboard-read; clipboard-write"
      />
    </div>
  );
}