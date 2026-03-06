export default function PendingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 text-white bg-[#060b14]">
      <div className="max-w-md w-full rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="text-xl font-semibold">Waiting for approval</div>
        <div className="mt-2 text-sm opacity-80">
          Your account was created, but access is pending approval.
          <br />
          Message the admin to get approved.
        </div>
      </div>
    </div>
  );
}