"use client";

import { useState } from "react";
import { storefrontApi } from "./api";
import MediaField from "./MediaField";
import type { ProgressFacts, TeamRow } from "./types";

function sorted(items: TeamRow[]): TeamRow[] {
  return [...items].sort((a, b) => a.sort_order - b.sort_order);
}

interface MemberDraft {
  name: string;
  role: string;
  bio: string;
  photoUrl: string | null;
  visible: boolean;
}

const EMPTY_DRAFT: MemberDraft = { name: "", role: "", bio: "", photoUrl: null, visible: true };

const inputClass =
  "rounded-lg border border-line bg-card px-3 py-2 text-sm outline-none focus:border-blue disabled:opacity-40";

/**
 * Public team manager. Profiles are display-only records — creating one
 * never creates a login or touches `business_members`. Cards (not tables)
 * keep it pleasant; actions never depend on hover.
 */
export default function TeamSection({
  businessId,
  initial,
  onProgress,
}: {
  businessId: string;
  initial: TeamRow[];
  onProgress: (facts: ProgressFacts) => void;
}) {
  const [members, setMembers] = useState<TeamRow[]>(() => sorted(initial));
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<MemberDraft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function report(list: TeamRow[]) {
    onProgress({ visibleTeamCount: list.filter((m) => m.visible).length });
  }

  function fail(unknownError: unknown) {
    setError(
      unknownError instanceof Error ? unknownError.message : "Something went wrong. Please try again.",
    );
  }

  async function saveNew() {
    if (!draft.name.trim()) {
      setError("Please give the team member a name.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const maxOrder = members.reduce((max, m) => Math.max(max, m.sort_order), -1);
      const created = (await storefrontApi.addTeamMember(businessId, {
        name: draft.name.trim(),
        role: draft.role.trim(),
        bio: draft.bio.trim(),
        photoUrl: draft.photoUrl,
        visible: draft.visible,
        sortOrder: maxOrder + 1,
      })) as { member: TeamRow };
      const next = sorted([...members, created.member]);
      setMembers(next);
      report(next);
      setDraft(EMPTY_DRAFT);
      setAdding(false);
      setNotice("Team member added.");
    } catch (saveError: unknown) {
      fail(saveError);
    } finally {
      setBusy(false);
    }
  }

  function startEdit(member: TeamRow) {
    setEditingId(member.id);
    setDraft({
      name: member.name,
      role: member.role ?? "",
      bio: member.bio ?? "",
      photoUrl: member.photo_url,
      visible: member.visible,
    });
    setAdding(false);
    setConfirmingId(null);
    setError(null);
  }

  async function saveEdit(member: TeamRow) {
    if (!draft.name.trim()) {
      setError("Please give the team member a name.");
      return;
    }
    setBusyId(member.id);
    setError(null);
    try {
      await storefrontApi.patchTeamMember(businessId, member.id, {
        name: draft.name.trim(),
        role: draft.role.trim(),
        bio: draft.bio.trim(),
        photoUrl: draft.photoUrl,
        visible: draft.visible,
      });
      const next = members.map((row) =>
        row.id === member.id
          ? {
              ...row,
              name: draft.name.trim(),
              role: draft.role.trim() || null,
              bio: draft.bio.trim() || null,
              photo_url: draft.photoUrl,
              visible: draft.visible,
            }
          : row,
      );
      setMembers(next);
      report(next);
      setEditingId(null);
      setNotice("Team member updated.");
    } catch (saveError: unknown) {
      fail(saveError);
    } finally {
      setBusyId(null);
    }
  }

  async function move(member: TeamRow, direction: -1 | 1) {
    const ordered = sorted(members);
    const other = ordered[ordered.findIndex((row) => row.id === member.id) + direction];
    if (!other) return;
    setBusyId(member.id);
    setError(null);
    try {
      await storefrontApi.patchTeamMember(businessId, member.id, { sortOrder: other.sort_order });
      await storefrontApi.patchTeamMember(businessId, other.id, { sortOrder: member.sort_order });
      setMembers((current) =>
        current.map((row) => {
          if (row.id === member.id) return { ...row, sort_order: other.sort_order };
          if (row.id === other.id) return { ...row, sort_order: member.sort_order };
          return row;
        }),
      );
    } catch (saveError: unknown) {
      fail(saveError);
    } finally {
      setBusyId(null);
    }
  }

  async function remove(member: TeamRow) {
    setBusyId(member.id);
    setError(null);
    try {
      await storefrontApi.deleteTeamMember(businessId, member.id);
      const next = members.filter((row) => row.id !== member.id);
      setMembers(next);
      setConfirmingId(null);
      report(next);
      setNotice("Team member removed.");
    } catch (saveError: unknown) {
      fail(saveError);
    } finally {
      setBusyId(null);
    }
  }

  function memberForm(
    current: MemberDraft,
    setCurrent: (draft: MemberDraft) => void,
    onSave: () => void,
    onCancel: () => void,
    saving: boolean,
    saveLabel: string,
  ) {
    return (
      <div className="flex flex-col gap-3">
        <MediaField
          label="Photo"
          value={current.photoUrl}
          kind="team"
          aspect="square"
          businessId={businessId}
          disabled={saving}
            onChange={(url) => setCurrent({ ...current, photoUrl: url })}
        />
        <label className="flex flex-col gap-1 text-sm font-medium">
          Name
          <input
            value={current.name}
            onChange={(e) => setCurrent({ ...current, name: e.target.value })}
            disabled={saving}
            maxLength={80}
            placeholder="Watpo"
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Role / title
          <input
            value={current.role}
            onChange={(e) => setCurrent({ ...current, role: e.target.value })}
            disabled={saving}
            maxLength={80}
            placeholder="Owner · Barber"
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Short bio
          <textarea
            value={current.bio}
            onChange={(e) => setCurrent({ ...current, bio: e.target.value })}
            disabled={saving}
            maxLength={500}
            rows={3}
            placeholder="A line or two customers would enjoy reading."
            className={inputClass}
          />
        </label>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={current.visible}
            disabled={saving}
            onChange={(e) => setCurrent({ ...current, visible: e.target.checked })}
            className="h-5 w-5 accent-[#15547D]"
          />
          Visible on the storefront
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={onSave}
            className="rounded-full bg-blue px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-strong disabled:opacity-40"
          >
            {saving ? "Saving…" : saveLabel}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onCancel}
            className="rounded-full border border-line px-5 py-2 text-sm font-medium text-ink-soft hover:text-ink disabled:opacity-40"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <section
      id="section-team"
      aria-labelledby="section-team-title"
      className="scroll-mt-24 rounded-2xl border border-line bg-card p-5 sm:p-6"
    >
      <h2 id="section-team-title" className="text-lg font-semibold tracking-tight">
        Team
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        Public profiles for the people customers meet. These are not Kivo logins.
      </p>

      <div aria-live="polite">
        {error && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </div>
        )}
        {notice && (
          <p role="status" className="mt-4 text-sm text-ink-soft">
            {notice}
          </p>
        )}
      </div>

      {members.length === 0 && !adding ? (
        <div className="mt-4 rounded-xl border border-dashed border-line bg-paper p-6 text-center">
          <p className="font-medium">No team members yet</p>
          <p className="mt-1 text-sm text-ink-soft">
            Introduce the people behind the business — it builds trust.
          </p>
        </div>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {members.map((member, index) => (
            <li key={member.id} className="rounded-xl border border-line bg-paper p-4">
              {editingId === member.id ? (
                memberForm(
                  draft,
                  setDraft,
                  () => saveEdit(member),
                  () => setEditingId(null),
                  busyId === member.id,
                  "Save changes",
                )
              ) : (
                <div className="flex items-start gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-muted text-lg font-bold text-ink-soft">
                    {member.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={member.photo_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span aria-hidden="true">{member.name.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {member.name}
                      {!member.visible && (
                        <span className="ml-2 rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-ink-soft">
                          Hidden
                        </span>
                      )}
                    </p>
                    {member.role && <p className="text-sm text-ink-soft">{member.role}</p>}
                    {member.bio && (
                      <p className="mt-1 line-clamp-2 text-sm text-ink-soft">{member.bio}</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        disabled={busyId !== null}
                        onClick={() => startEdit(member)}
                        className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium transition-colors hover:border-blue/50 disabled:opacity-40"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={busyId !== null || index === 0}
                        onClick={() => move(member, -1)}
                        aria-label={`Move ${member.name} earlier`}
                        className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium transition-colors hover:border-blue/50 disabled:opacity-30"
                      >
                        ↑ Move up
                      </button>
                      <button
                        type="button"
                        disabled={busyId !== null || index === members.length - 1}
                        onClick={() => move(member, 1)}
                        aria-label={`Move ${member.name} later`}
                        className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium transition-colors hover:border-blue/50 disabled:opacity-30"
                      >
                        ↓ Move down
                      </button>
                      {confirmingId === member.id ? (
                        <button
                          type="button"
                          disabled={busyId !== null}
                          onClick={() => remove(member)}
                          className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-40"
                        >
                          {busyId === member.id ? "Removing…" : "Confirm remove"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busyId !== null}
                          onClick={() => setConfirmingId(member.id)}
                          className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:border-red-300 hover:text-red-600 disabled:opacity-40"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4">
        {adding ? (
          <div className="rounded-xl border border-blue/40 bg-blue-mist/40 p-4">
            <p className="mb-3 font-medium">New team member</p>
            {memberForm(
              draft,
              setDraft,
              saveNew,
              () => {
                setAdding(false);
                setDraft(EMPTY_DRAFT);
              },
              busy,
              "Add member",
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setAdding(true);
              setDraft(EMPTY_DRAFT);
              setEditingId(null);
              setError(null);
            }}
            className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-line bg-card px-5 py-2.5 text-sm font-medium transition-colors hover:border-blue/50"
          >
            Add team member
          </button>
        )}
      </div>
    </section>
  );
}

