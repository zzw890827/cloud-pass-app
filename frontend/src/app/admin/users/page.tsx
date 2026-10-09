"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { useAuth } from "@/context/AuthContext";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Input from "@/components/ui/Input";
import Spinner from "@/components/ui/Spinner";
import type { AdminExamDomain, AdminUser, Exam } from "@/types";

type Flag = "is_active" | "is_admin" | "can_use_exam_mode";

export default function UserManagementPage() {
  const { user, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [domains, setDomains] = useState<AdminExamDomain[]>([]);
  // Exam whose domain picker is open in the detail pane.
  const [openExamId, setOpenExamId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (authLoading || !user?.is_admin) return;
    Promise.all([api.getAdminUsers(), api.getExams(), api.getAdminExamDomains()])
      .then(([userList, examList, domainList]) => {
        setUsers(userList);
        setExams(examList);
        setDomains(domainList);
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

  const domainsByExam = useMemo(() => {
    const groups = new Map<number, AdminExamDomain[]>();
    for (const d of domains) {
      const list = groups.get(d.exam_id);
      if (list) list.push(d);
      else groups.set(d.exam_id, [d]);
    }
    return groups;
  }, [domains]);

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

  /**
   * Toggle one domain in `target`'s whitelist for `examId`. Checking every
   * domain lifts the restriction (stored as an empty list); the last checked
   * domain cannot be unchecked — revoke the exam itself for that.
   */
  const toggleDomain = async (target: AdminUser, examId: number, domainId: number) => {
    const all = (domainsByExam.get(examId) ?? []).map((d) => d.id);
    // Drop ids of domains that no longer exist: they would fail validation on
    // save and skew the "everything checked" test below.
    const current = (target.domain_restrictions[examId] ?? all).filter((id) => all.includes(id));
    const toggled = current.includes(domainId)
      ? current.filter((id) => id !== domainId)
      : [...current, domainId];
    if (toggled.length === 0) return;
    await saveDomains(target, examId, toggled.length >= all.length ? [] : toggled);
  };

  const saveDomains = async (target: AdminUser, examId: number, next: number[]) => {
    const previous = target.domain_restrictions;
    const restrictions = { ...previous };
    if (next.length === 0) delete restrictions[examId];
    else restrictions[examId] = next;

    setError("");
    setSaving(true);
    patchUser(target.id, { domain_restrictions: restrictions });
    try {
      await api.setUserExamDomains(target.id, examId, next);
    } catch (err: unknown) {
      patchUser(target.id, { domain_restrictions: previous });
      setError(err instanceof Error ? err.message : "Failed to update domain access");
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
        page first. Within any exam a user can access, you can also limit which domains they see,
        and turn exam mode off per user.
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
                    onClick={() => {
                      setSelectedId(u.id);
                      setOpenExamId(null);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                      u.id === selectedId ? "bg-accent-50 text-accent-700" : "hover:bg-gray-100"
                    }`}
                  >
                    <span className="block text-sm font-medium truncate">{u.email}</span>
                    <span className="mt-1 flex items-center gap-1.5">
                      {u.is_admin && <Badge color="accent">Admin</Badge>}
                      {!u.is_active && <Badge color="red">Inactive</Badge>}
                      {!u.is_admin && !u.can_use_exam_mode && <Badge>No exam mode</Badge>}
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
                <FlagToggle
                  label="Exam mode"
                  on={selected.can_use_exam_mode}
                  self={false}
                  busy={saving}
                  onToggle={() => toggleFlag(selected, "can_use_exam_mode")}
                />
              </div>
              {selected.id === user.id && (
                <p className="mt-2 text-xs text-gray-400">
                  You cannot change your own Active or Admin status.
                </p>
              )}
              {selected.is_admin && (
                <p className="mt-2 text-xs text-gray-400">
                  Admins can always use exam mode and see every domain.
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
                        {providerExams.map((exam) => {
                          const accessible =
                            exam.is_public || selected.granted_exam_ids.includes(exam.id);
                          const examDomains = domainsByExam.get(exam.id) ?? [];
                          const allowed = selected.domain_restrictions[exam.id];
                          const allowedCount = allowed
                            ? examDomains.filter((d) => allowed.includes(d.id)).length
                            : examDomains.length;
                          const open = openExamId === exam.id;
                          return (
                            <li key={exam.id}>
                              <div className="flex items-center gap-2">
                                <label
                                  className={`flex flex-1 min-w-0 items-center gap-2.5 px-2 py-1.5 rounded-lg ${
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
                                {/* Domain whitelist — only meaningful once the user can open the exam */}
                                {!selected.is_admin && accessible && examDomains.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => setOpenExamId(open ? null : exam.id)}
                                    aria-expanded={open}
                                    className={`shrink-0 text-xs px-2 py-1 rounded-md border transition-colors ${
                                      allowed
                                        ? "border-amber-200 bg-amber-50 text-amber-700"
                                        : "border-gray-200 text-gray-500 hover:bg-gray-50"
                                    }`}
                                  >
                                    {allowed
                                      ? `${allowedCount} of ${examDomains.length} domains`
                                      : "All domains"}{" "}
                                    {open ? "▴" : "▾"}
                                  </button>
                                )}
                              </div>
                              {open && !selected.is_admin && accessible && examDomains.length > 0 && (
                                <div className="ml-8 mt-1 mb-2 p-2 rounded-lg bg-gray-50">
                                  <ul className="space-y-1">
                                    {examDomains.map((d) => {
                                      const checked = !allowed || allowed.includes(d.id);
                                      // The last checked box cannot be cleared — revoke the exam instead.
                                      const isLast = checked && allowedCount === 1;
                                      return (
                                        <li key={d.id}>
                                          <label
                                            className="flex items-center gap-2.5 px-2 py-1 rounded-md hover:bg-white cursor-pointer"
                                            title={
                                              isLast
                                                ? "At least one domain must stay selected — revoke the exam instead"
                                                : undefined
                                            }
                                          >
                                            <input
                                              type="checkbox"
                                              className="h-4 w-4 rounded border-gray-300 text-accent-600 focus:ring-accent-500"
                                              checked={checked}
                                              disabled={saving || isLast}
                                              onChange={() => toggleDomain(selected, exam.id, d.id)}
                                            />
                                            <span className="text-sm text-gray-900">{d.name}</span>
                                            <span className="text-xs font-mono text-gray-400">
                                              {d.code}
                                            </span>
                                          </label>
                                        </li>
                                      );
                                    })}
                                  </ul>
                                  <div className="mt-2 flex items-center justify-between gap-2 px-2">
                                    <p className="text-xs text-gray-400">
                                      {allowed
                                        ? "Questions outside the selected domains (and without a domain) are hidden from this user. An in-progress exam holding hidden questions is abandoned when you narrow the selection."
                                        : "Unrestricted. Uncheck a domain to hide its questions (abandons an in-progress exam that holds them)."}
                                    </p>
                                    {allowed && (
                                      <button
                                        type="button"
                                        disabled={saving}
                                        onClick={() => saveDomains(selected, exam.id, [])}
                                        className="shrink-0 text-xs text-accent-600 hover:underline disabled:opacity-50"
                                      >
                                        Allow all
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )}
                            </li>
                          );
                        })}
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
