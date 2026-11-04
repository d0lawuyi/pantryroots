import { useState, type FormEvent } from "react";
import { usePersistentState } from "@/lib/storage";
import { cleanItem } from "@/lib/pantry";
import { useApp } from "@/lib/app-context";
import { Icon } from "@/components/Icon";
import { PageHeader, Section, Segmented, Sheet } from "@/components/ui";

type Kind = "offer" | "request";
type Post = { id: string; name: string; kind: Kind; item: string; note?: string; distance?: string; at: number; mine?: boolean };

const HOUR = 3_600_000;
const SAMPLE: Post[] = [
  { id: "s1", name: "Keisha M.", kind: "offer", item: "Ripe plantain", note: "Bought a full box, have 6 spare.", distance: "0.4 mi", at: Date.now() - 0.2 * HOUR },
  { id: "s2", name: "Marcus T.", kind: "request", item: "Scotch bonnet", note: "Just need two for tonight's stew.", distance: "0.8 mi", at: Date.now() - 0.6 * HOUR },
  { id: "s3", name: "Ama K.", kind: "offer", item: "Red palm oil", note: "Half a bottle, happy to pour some off.", distance: "1.1 mi", at: Date.now() - 1.3 * HOUR },
  { id: "s4", name: "Tesfaye B.", kind: "offer", item: "Berbere", note: "Homemade, from my mother's recipe.", distance: "1.6 mi", at: Date.now() - 5 * HOUR },
];

const AVATAR_TONES = [
  ["var(--indigo-tint)", "var(--indigo-text)"],
  ["var(--gold-tint)", "var(--gold-ink)"],
  ["var(--leaf-tint)", "var(--leaf)"],
  ["var(--pepper-tint)", "var(--pepper)"],
];

function toneFor(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length];
}

function ago(t: number) {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} hr ago` : `${Math.round(h / 24)} d ago`;
}

export function NeighborsScreen() {
  const { notify } = useApp();
  const [mine, setMine] = usePersistentState<Post[]>("posts", []);
  const [sent, setSent] = usePersistentState<string[]>("messaged", []);
  const [filter, setFilter] = useState<"all" | Kind>("all");
  const [composing, setComposing] = useState(false);
  const [messaging, setMessaging] = useState<Post | null>(null);

  const posts = [...mine, ...SAMPLE].filter((p) => filter === "all" || p.kind === filter).sort((a, b) => b.at - a.at);

  return (
    <div className="page">
      <PageHeader
        title="Neighbors"
        lede="Borrow an ingredient from someone nearby before you buy a whole bottle."
        action={
          <button type="button" className="btn btn--primary btn--sm" onClick={() => setComposing(true)}>
            <Icon name="plus" size={16} strokeWidth={2} />
            Post
          </button>
        }
      />

      <Segmented
        label="Show"
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: "All" },
          { value: "offer", label: "Offering" },
          { value: "request", label: "Looking for" },
        ]}
      />

      <div style={{ height: 16 }} />
      <Section note="Sample neighbors are shown while accounts are being built. Your posts stay on this device.">
        {posts.length === 0 ? (
          <div className="group empty"><strong>Nothing here yet</strong>Be the first to post.</div>
        ) : (
          <ul className="group">
            {posts.map((p) => {
              const [bg, fg] = toneFor(p.name);
              const done = sent.includes(p.id);
              return (
                <li key={p.id} className="row row--inset" style={{ alignItems: "flex-start", paddingBlock: 14 }}>
                  <span className="avatar" style={{ ["--av" as string]: bg, ["--av-ink" as string]: fg }} aria-hidden="true">
                    {p.name[0]}
                  </span>
                  <div className="row__body">
                    <p className="small muted">
                      {p.mine ? "You" : p.name}
                      {p.distance ? `, ${p.distance}` : ""}, {ago(p.at)}
                    </p>
                    <p className="row__title" style={{ marginTop: 2 }}>
                      <span className={p.kind === "offer" ? "pill pill--have" : "pill pill--need"} style={{ marginRight: 8, verticalAlign: 1 }}>
                        {p.kind === "offer" ? "Offering" : "Looking for"}
                      </span>
                      {p.item}
                    </p>
                    {p.note && <p className="small muted" style={{ marginTop: 4 }}>{p.note}</p>}
                  </div>
                  {p.mine ? (
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Delete your post about ${p.item}`}
                      onClick={() => { setMine((m) => m.filter((x) => x.id !== p.id)); notify("Post deleted"); }}
                    >
                      <Icon name="trash" size={18} />
                    </button>
                  ) : (
                    <button type="button" className="btn btn--secondary btn--sm" disabled={done} onClick={() => setMessaging(p)}>
                      {done ? "Sent" : "Message"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {composing && (
        <Composer
          onClose={() => setComposing(false)}
          onPost={(p) => {
            setMine((m) => [p, ...m]);
            setFilter("all");
            setComposing(false);
            notify("Posted");
          }}
        />
      )}

      {messaging && (
        <MessageSheet
          post={messaging}
          onClose={() => setMessaging(null)}
          onSend={() => {
            setSent((s) => [...s, messaging.id]);
            notify(`Message sent to ${messaging.name}`);
            setMessaging(null);
          }}
        />
      )}
    </div>
  );
}

function Composer({ onClose, onPost }: { onClose: () => void; onPost: (p: Post) => void }) {
  const [kind, setKind] = useState<Kind>("request");
  const [item, setItem] = useState("");
  const [note, setNote] = useState("");

  function submit(e?: FormEvent) {
    e?.preventDefault();
    if (!item.trim()) return;
    onPost({ id: crypto.randomUUID(), name: "You", kind, item: cleanItem(item), note: note.trim() || undefined, at: Date.now(), mine: true });
  }

  return (
    <Sheet
      title="New post"
      onClose={onClose}
      footer={<button type="button" className="btn btn--primary btn--block" disabled={!item.trim()} onClick={() => submit()}>Post</button>}
    >
      <form className="stack stack--lg" onSubmit={submit}>
        <Segmented
          label="Post type"
          value={kind}
          onChange={setKind}
          options={[
            { value: "request", label: "I'm looking for" },
            { value: "offer", label: "I can share" },
          ]}
        />
        <div>
          <label className="label" htmlFor="post-item">Ingredient</label>
          <input id="post-item" className="input" value={item} onChange={(e) => setItem(e.target.value)} placeholder="e.g. Egusi" autoFocus />
        </div>
        <div>
          <label className="label" htmlFor="post-note">Details (optional)</label>
          <textarea id="post-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="How much, and when you can meet" />
        </div>
      </form>
    </Sheet>
  );
}

function MessageSheet({ post, onClose, onSend }: { post: Post; onClose: () => void; onSend: () => void }) {
  const [text, setText] = useState(
    post.kind === "offer"
      ? `Hi ${post.name.split(" ")[0]}, is the ${post.item.toLowerCase()} still available? I can pick it up today.`
      : `Hi ${post.name.split(" ")[0]}, I have ${post.item.toLowerCase()} you can have. When works for you?`,
  );
  return (
    <Sheet
      title={`Message ${post.name}`}
      onClose={onClose}
      footer={
        <button type="button" className="btn btn--primary btn--block" disabled={!text.trim()} onClick={onSend}>
          <Icon name="send" size={18} />
          Send
        </button>
      }
    >
      <label className="label" htmlFor="msg">Message</label>
      <textarea id="msg" className="input" value={text} onChange={(e) => setText(e.target.value)} rows={4} />
      <p className="section__note">Meet somewhere public. Nothing is paid through PantryRoots.</p>
    </Sheet>
  );
}
