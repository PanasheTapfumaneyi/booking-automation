export interface TeamProfile {
  name: string;
  role: string | null;
  bio: string | null;
  photoUrl: string | null;
}

/**
 * Editorial team presentation: human rows, not an employee directory.
 * A single person looks just as intentional as a crew.
 */
export default function StorefrontTeam({ members }: { members: TeamProfile[] }) {
  if (members.length === 0) return null;
  return (
    <section id="team" aria-labelledby="team-title" className="scroll-mt-20">
      <div className="mx-auto w-full max-w-4xl px-5 py-14 sm:py-20">
        <h2
          id="team-title"
          className="text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight text-ink"
        >
          Meet the team
        </h2>
        <ul className={`mt-8 grid gap-x-12 gap-y-10 ${members.length > 1 ? "sm:grid-cols-2" : "max-w-xl"}`}>
          {members.map((member) => (
            <li key={member.name} className="flex items-start gap-4">
              <span
                aria-hidden="true"
                className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-muted text-xl font-bold text-ink-soft"
              >
                {member.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={member.photoUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                ) : (
                  member.name.charAt(0).toUpperCase()
                )}
              </span>
              <span className="min-w-0">
                <span className="block text-lg font-semibold text-ink">{member.name}</span>
                {member.role && (
                  <span className="mt-0.5 block text-sm font-medium text-ink-soft">{member.role}</span>
                )}
                {member.bio && (
                  <span className="mt-1.5 block leading-relaxed text-ink-soft">{member.bio}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
