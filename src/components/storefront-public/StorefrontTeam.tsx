export interface TeamProfile {
  name: string;
  role: string | null;
  bio: string | null;
  photoUrl: string | null;
}

/**
 * Professional team presentation: member cards with photo, name, role.
 * A single person looks just as intentional as a crew.
 */
export default function StorefrontTeam({ members }: { members: TeamProfile[] }) {
  if (members.length === 0) return null;
  return (
    <section id="team" aria-labelledby="team-title" className="scroll-mt-20">
      <div className="mx-auto w-full max-w-6xl px-5 py-12 sm:py-16">
        <div className="max-w-2xl">
          <h2
            id="team-title"
            className="text-2xl font-bold tracking-tight text-ink sm:text-[1.75rem]"
          >
            Meet the team
          </h2>
        </div>
        <ul className={`mt-8 grid gap-4 ${members.length > 1 ? "sm:grid-cols-2 lg:grid-cols-3" : "max-w-xl"}`}>
          {members.map((member) => (
            <li key={member.name} className="flex items-start gap-4 rounded-2xl border border-line bg-card p-5 shadow-sm">
              <span
                aria-hidden="true"
                className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-muted text-lg font-bold text-ink-soft ring-1 ring-line"
              >
                {member.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={member.photoUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                ) : (
                  member.name.charAt(0).toUpperCase()
                )}
              </span>
              <span className="min-w-0">
                <span className="block text-[17px] font-semibold text-ink">{member.name}</span>
                {member.role && (
                  <span className="mt-0.5 block text-sm font-medium text-ink-soft">{member.role}</span>
                )}
                {member.bio && (
                  <span className="mt-1.5 block text-[15px] leading-relaxed text-ink-soft">{member.bio}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
