"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { useAuth } from "@/context/AuthContext";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Input from "@/components/ui/Input";
import Spinner from "@/components/ui/Spinner";
import type { AdminUser, Exam } from "@/types";

type Flag = "is_active" | "is_admin";

export default function UserManagementPage() {
  const { user, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (authLoading || !user?.is_admin) return;
    Promise.all([api.getAdminUsers(), api.getExams()])
      .then(([userList, examList]) => {
        setUsers(userList);
        setExams(examList);
        setSelectedId((prev) => prev ?? userList[0]?.id ?? null);
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load users")
      )
      .finally(() => setLoading(false));
  }, [user, authLoading]);

  const shownUsers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return users;
    return users.filter(
      (u) =>
        u.email.toLowerCase().includes(needle) ||
        u.display_name.toLowerCase().includes(needle)
    );
  }, [users, search]);

  // Only show a detail pane for a user the (possibly filtered) list still shows.
  const selected = shownUsers.find((u) => u.id === selectedId) ?? null;

  const examsByProvider = useMemo(() => {
    const groups = new Map<string, Exam[]>();
    for (const exam of exams) {
      const list = groups.get(exam.provider_name);
      if (list) list.push(exam);
      else groups.set(exam.provider_name, [exam]);
    }
    // Providers alphabetically; within each, restricted exams first — those are
    // the only ones the checkboxes actually affect.
    return [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([provider, list]) => [
        provider,
        [...list].sort((a, b) =>
          a.is_public === b.is_public ? a.code.localeCompare(b.code) : a.is_public ? 1 : -1
        ),
      ] as [string, Exam[]]);
  }, [exams]);

  const patchUser = (userId: number, patch: Partial<AdminUser>) =>
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, ...patch } : u)));

  const toggleFlag = async (target: AdminUser, flag: Flag) => {
    const next = !target[flag];
    setError("");
    setSaving(true);
    patchUser(target.id, { [flag]: next } as Partial<AdminUser>);
    try {
      await api.updateAdminUser(target.id, { [flag]: next });
    } catch (err: unknown) {
      patchUser(target.id, { [flag]: !next } as Partial<AdminUser>);
      setError(err instanceof Error ? err.message : "Failed to update user");
    } finally {
      setSaving(false);
    }
  };

  const toggleExam = async (target: AdminUser, examId: number) => {
    const granted = target.granted_exam_ids.includes(examId);
    const next = granted
      ? target.granted_exam_ids.filter((id) => id !== examId)
      : [...target.granted_exam_ids, examId];

    setError("");
    setSaving(true);
    patchUser(target.id, { granted_exam_ids: next });
    try {
      await api.setUserExamAccess(target.id, next);
    } catch (err: unknown) {
      patchUser(target.id, { granted_exam_ids: target.granted_exam_ids });
      setError(err instanceof Error ? err.message : "Failed to update exam access");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) return <Spinner className="mt-20" />;
  if (!user?.is_admin) return <p className="text-red-500 mt-10">Admin access required.</p>;

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between gap-4 mb-2">
        <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
        <Link href="/admin/maintenance" className="text-sm text-accent-600 hover:underline">
          Maintenance
        </Link>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Grant users access to restricted exams. Public exams are open to everyone — make an exam
        restricted on the{" "}
        <Link href="/admin/maintenance" className="text-accent-600 hover:underline">
          Maintenance
        </Link>{" "}
        page first.
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {loading ? (
        <Spinner className="mt-10" />
      ) : users.length === 0 ? (
        <p className="text-sm text-gray-500">No users found.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4 items-start">
          {/* User list */}
          <Card className="p-2">
            <div className="p-1 pb-2">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${users.length} users...`}
              />
            </div>
            <ul className="space-y-1 max-h-[70vh] overflow-y-auto">
              {shownUsers.map((u) => (
                <li key={u.id}>
                  <button
                    onClick={() => setSelectedId(u.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                      u.id === selectedId ? "bg-accent-50 text-accent-700" : "hover:bg-gray-100"
                    }`}
                  >
                    <span className="block text-sm font-medium truncate">{u.email}</span>
                    <span className="mt-1 flex items-center gap-1.5">
                      {u.is_admin && <Badge color="accent">Admin</Badge>}
                      {!u.is_active && <Badge color="red">Inactive</Badge>}
                      {!u.is_admin && (
                        <span className="text-xs text-gray-400">
                          {u.granted_exam_ids.length} granted
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
              {shownUsers.length === 0 && (
                <li className="px-3 py-2 text-sm text-gray-500">No matching users.</li>
              )}
            </ul>
          </Card>

          {/* Detail pane */}
          {selected && (
            <Card className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{selected.email}</p>
                  <p className="text-sm text-gray-500 truncate">{selected.display_name}</p>
                </div>
                {saving && <span className="text-xs text-gray-400 shrink-0">Saving…</span>}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <FlagToggle
                  label="Active"
                  on={selected.is_active}
                  self={selected.id === user.id}
                  busy={saving}
                  onToggle={() => toggleFlag(selected, "is_active")}
                />
                <FlagToggle
                  label="Admin"
                  on={selected.is_admin}
                  self={selected.id === user.id}
                  busy={saving}
                  onToggle={() => toggleFlag(selected, "is_admin")}
                />
              </div>
              {selected.id === user.id && (
                <p className="mt-2 text-xs text-gray-400">
                  You cannot change your own Active or Admin status.
                </p>
              )}

              <div className="mt-5 pt-4 border-t border-gray-100">
                <h2 className="text-sm font-semibold text-gray-900 mb-1">Exam access</h2>
                {selected.is_admin ? (
                  <p className="text-sm text-gray-500">
                    Admins can access every exam regardless of these grants.
                  </p>
                ) : (
                  <p className="text-xs text-gray-400 mb-3">
                    Public exams are already available to this user.
                  </p>
                )}

                <div className="space-y-4">
                  {examsByProvider.map(([providerName, providerExams]) => (
                    <div key={providerName}>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">
                        {providerName}
                      </p>
                      <ul className="space-y-1">
                        {providerExams.map((exam) => (
                          <li key={exam.id}>
                            <label
                              className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg ${
                                exam.is_public
                                  ? "opacity-50"
                                  : "hover:bg-gray-50 cursor-pointer"
                              }`}
                            >
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-gray-300 text-accent-600 focus:ring-accent-500"
                                checked={
                                  exam.is_public ||
                                  selected.granted_exam_ids.includes(exam.id)
                                }
                                disabled={exam.is_public || saving}
                                onChange={() => toggleExam(selected, exam.id)}
                              />
                              <span className="text-sm font-medium text-gray-900">
                                {exam.code}
                              </span>
                              <span className="text-sm text-gray-500 truncate">{exam.name}</span>
                              {exam.is_public && (
                                <Badge className="ml-auto shrink-0">Public</Badge>
                              )}
                            </label>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  {exams.length === 0 && (
                    <p className="text-sm text-gray-500">No exams found.</p>
                  )}
                </div>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function FlagToggle({
  label,
  on,
  self,
  busy,
  onToggle,
}: {
  label: string;
  on: boolean;
  self: boolean;
  /** Another save is in flight — block overlapping writes for this user. */
  busy: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      disabled={self || busy}
      title={self ? "You cannot change your own status" : undefined}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
        on
          ? "border-accent-200 bg-accent-50 text-accent-700"
          : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full ${on ? "bg-accent-600" : "bg-gray-300"}`}
        aria-hidden
      />
      {label}
    </button>
  );
}
