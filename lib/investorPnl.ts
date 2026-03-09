export type InvestorMember = {
  id: string;
  name: string;
  role: string;
  active: boolean;
};

export type InvestorTransaction = {
  id: string;
  member_id: string;
  txn_type: "deposit" | "withdrawal" | "grant";
  amount: number;
  units: number;
  notes: string | null;
  effective_at: string;
};

export type InvestorRow = {
  id: string;
  name: string;
  role: string;
  netCashContributed: number;
  grantedUnits: number;
  depositUnits: number;
  withdrawalUnits: number;
  totalUnits: number;
  ownershipPct: number;
  currentValue: number;
  pnlDollar: number;
  returnPct: number | null;
};

export function computeInvestorRows(args: {
  members: InvestorMember[];
  transactions: InvestorTransaction[];
  totalEquity: number;
}) {
  const { members, transactions, totalEquity } = args;

  const byMember = new Map<
    string,
    {
      netCashContributed: number;
      grantedUnits: number;
      depositUnits: number;
      withdrawalUnits: number;
      totalUnits: number;
    }
  >();

  for (const member of members) {
    byMember.set(member.id, {
      netCashContributed: 0,
      grantedUnits: 0,
      depositUnits: 0,
      withdrawalUnits: 0,
      totalUnits: 0,
    });
  }

  for (const txn of transactions) {
    const bucket = byMember.get(txn.member_id);
    if (!bucket) continue;

    if (txn.txn_type === "deposit") {
      bucket.netCashContributed += Number(txn.amount || 0);
      bucket.depositUnits += Number(txn.units || 0);
      bucket.totalUnits += Number(txn.units || 0);
    }

    if (txn.txn_type === "withdrawal") {
      bucket.netCashContributed -= Number(txn.amount || 0);
      bucket.withdrawalUnits += Number(txn.units || 0);
      bucket.totalUnits -= Number(txn.units || 0);
    }

    if (txn.txn_type === "grant") {
      bucket.grantedUnits += Number(txn.units || 0);
      bucket.totalUnits += Number(txn.units || 0);
    }
  }

  const totalUnits = Array.from(byMember.values()).reduce(
    (sum, x) => sum + x.totalUnits,
    0
  );

  const unitPrice = totalUnits > 0 ? totalEquity / totalUnits : 0;

  const rows: InvestorRow[] = members.map((member) => {
    const x = byMember.get(member.id)!;
    const currentValue = x.totalUnits * unitPrice;
    const pnlDollar = currentValue - x.netCashContributed;
    const returnPct =
      x.netCashContributed > 0 ? pnlDollar / x.netCashContributed : null;
    const ownershipPct = totalUnits > 0 ? x.totalUnits / totalUnits : 0;

    return {
      id: member.id,
      name: member.name,
      role: member.role,
      netCashContributed: x.netCashContributed,
      grantedUnits: x.grantedUnits,
      depositUnits: x.depositUnits,
      withdrawalUnits: x.withdrawalUnits,
      totalUnits: x.totalUnits,
      ownershipPct,
      currentValue,
      pnlDollar,
      returnPct,
    };
  });

  rows.sort((a, b) => b.currentValue - a.currentValue);

  const netContributedCapital = rows.reduce(
    (sum, row) => sum + row.netCashContributed,
    0
  );

  return {
    totalUnits,
    unitPrice,
    rows,
    netContributedCapital,
  };
}