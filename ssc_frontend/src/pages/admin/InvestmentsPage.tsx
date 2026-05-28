import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { investmentsApi } from "@/api/services";
import {
  PageHeader,
  PageLoader,
  EmptyState,
  formatNaira,
  Modal,
  ErrorAlert,
  SuccessAlert,
  HijriMonthYearPicker,
} from "@/components/common";

export default function InvestmentsPage() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [showDist, setShowDist] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [hijriMonth, setHijriMonth] = useState(1);
  const [hijriYear, setHijriYear] = useState(1446);
  const [distHijriMonth, setDistHijriMonth] = useState(1);
  const [distHijriYear, setDistHijriYear] = useState(1446);

  const { data: investments, isLoading } = useQuery({
    queryKey: ["investments"],
    queryFn: () => investmentsApi.list().then((r) => r.data),
  });

  const { data: distributions } = useQuery({
    queryKey: ["distributions"],
    queryFn: () => investmentsApi.distributions.list().then((r) => r.data),
  });

  const { register: regInv, handleSubmit: hsInv, reset: resetInv } = useForm();
  const {
    register: regDist,
    handleSubmit: hsDist,
    reset: resetDist,
  } = useForm();

  const addMutation = useMutation({
    mutationFn: (data: any) =>
      investmentsApi.create({
        ...data,
        hijri_month: hijriMonth,
        hijri_year: hijriYear,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["investments"] });
      resetInv();
      setShowAdd(false);
      setMsg("Investment recorded.");
    },
    onError: () => setErr("Failed to add investment."),
  });

  const distMutation = useMutation({
    mutationFn: (data: any) =>
      investmentsApi.distributions.create({
        ...data,
        hijri_month: distHijriMonth,
        hijri_year: distHijriYear,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["distributions"] });
      resetDist();
      setShowDist(false);
      setMsg("Distribution created.");
    },
    onError: () => setErr("Failed to create distribution."),
  });

  const distributeMutation = useMutation({
    mutationFn: (id: number) => investmentsApi.distributions.distribute(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["distributions"] });
      setMsg("Profit distributed to all active members.");
    },
    onError: (e: any) =>
      setErr(e?.response?.data?.error || "Distribution failed."),
  });

  return (
    <div>
      <PageHeader
        title="Investments & Profit"
        subtitle="Record investments and distribute profit"
        action={
          <div className="flex gap-2">
            <button onClick={() => setShowAdd(true)} className="btn-secondary">
              + Add Investment
            </button>
            <button onClick={() => setShowDist(true)} className="btn-primary">
              Create Distribution
            </button>
          </div>
        }
      />

      {msg && (
        <div className="mb-4">
          <SuccessAlert message={msg} />
        </div>
      )}
      {err && (
        <div className="mb-4">
          <ErrorAlert message={err} />
        </div>
      )}

      {/* Investments */}
      <div className="card mb-6">
        <div className="card-header">
          <h2 className="font-semibold">Investments</h2>
        </div>
        <div className="table-container rounded-none border-0">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Amount</th>
                <th>Islamic Date</th>
                <th>Recorded By</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center">
                    <PageLoader />
                  </td>
                </tr>
              ) : !investments?.results?.length ? (
                <tr>
                  <td colSpan={4}>
                    <EmptyState icon="📈" title="No investments recorded" />
                  </td>
                </tr>
              ) : (
                investments.results.map((i) => (
                  <tr key={i.id}>
                    <td className="font-medium">{i.name}</td>
                    <td>{formatNaira(i.amount)}</td>
                    <td className="text-sm text-gray-500">{i.hijri_display}</td>
                    <td className="text-sm text-gray-400">
                      {i.recorded_by_id}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Distributions */}
      <div className="card">
        <div className="card-header">
          <h2 className="font-semibold">Profit Distributions</h2>
        </div>
        <div className="table-container rounded-none border-0">
          <table className="table">
            <thead>
              <tr>
                <th>Investment</th>
                <th>%</th>
                <th>Total Profit</th>
                <th>Date</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {!distributions?.results?.length ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState icon="💰" title="No distributions yet" />
                  </td>
                </tr>
              ) : (
                distributions.results.map((d) => (
                  <tr key={d.id}>
                    <td className="font-medium">{d.investment_name}</td>
                    <td>{d.profit_percentage}%</td>
                    <td>{formatNaira(d.total_profit)}</td>
                    <td className="text-sm text-gray-500">{d.hijri_display}</td>
                    <td>
                      <span
                        className={
                          d.is_distributed ? "badge-success" : "badge-warning"
                        }
                      >
                        {d.is_distributed ? "Distributed" : "Pending"}
                      </span>
                    </td>
                    <td>
                      {!d.is_distributed && (
                        <button
                          onClick={() => distributeMutation.mutate(d.id)}
                          disabled={distributeMutation.isPending}
                          className="btn-primary text-xs px-2 py-1"
                        >
                          Distribute
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Investment Modal */}
      <Modal
        open={showAdd}
        title="Record Investment"
        onClose={() => setShowAdd(false)}
      >
        <form
          onSubmit={hsInv((data) => addMutation.mutate(data))}
          className="space-y-4"
        >
          <HijriMonthYearPicker
            month={hijriMonth}
            year={hijriYear}
            onMonthChange={setHijriMonth}
            onYearChange={setHijriYear}
          />
          <div>
            <label className="label">Investment Name</label>
            <input {...regInv("name", { required: true })} className="input" />
          </div>
          <div>
            <label className="label">Amount (₦)</label>
            <input
              {...regInv("amount", { required: true })}
              type="number"
              step="0.01"
              className="input"
            />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea {...regInv("description")} className="input h-16" />
          </div>
          <button
            type="submit"
            disabled={addMutation.isPending}
            className="btn-primary w-full"
          >
            {addMutation.isPending ? "Saving..." : "Record Investment"}
          </button>
        </form>
      </Modal>

      {/* Create Distribution Modal */}
      <Modal
        open={showDist}
        title="Create Profit Distribution"
        onClose={() => setShowDist(false)}
      >
        <form
          onSubmit={hsDist((data) => distMutation.mutate(data))}
          className="space-y-4"
        >
          <HijriMonthYearPicker
            month={distHijriMonth}
            year={distHijriYear}
            onMonthChange={setDistHijriMonth}
            onYearChange={setDistHijriYear}
          />
          <div>
            <label className="label">Investment</label>
            <select
              {...regDist("investment", {
                required: true,
                valueAsNumber: true,
              })}
              className="input"
            >
              <option value="">— Select —</option>
              {investments?.results?.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} — {formatNaira(i.amount)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Profit Percentage (%)</label>
            <input
              {...regDist("profit_percentage", { required: true })}
              type="number"
              step="0.01"
              min="0.01"
              max="100"
              className="input"
              placeholder="e.g. 10"
            />
          </div>
          <button
            type="submit"
            disabled={distMutation.isPending}
            className="btn-primary w-full"
          >
            {distMutation.isPending ? "Creating..." : "Create Distribution"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
