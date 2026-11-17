import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Centrifuge } from "centrifuge";
import { AppShell } from "./components/AppShell";
import { FormActions, Modal, preventSubmit } from "./components/Modal";
import { Icon } from "./components/Icon";
import { HomePage } from "./pages/HomePage";
import { ExplorePage } from "./pages/ExplorePage";
import { SetlistsPage } from "./pages/SetlistsPage";
import { SetlistDetailPage } from "./pages/SetlistDetailPage";
import { PitsPage } from "./pages/PitsPage";
import { PitRoomPage } from "./pages/PitRoomPage";
import { ProfilePage } from "./pages/ProfilePage";
import { JoinPage } from "./pages/JoinPage";
import type { ApiError, Identity, Page, PitSnapshot, PitSummary, Setlist, SetlistItem, TestTrack } from "./types";

const API = "/api";
const ACTIVE_PIT_STORAGE_KEY = "moshpit.activePit";
const SESSION_STORAGE_KEY = "moshpit.session";

type Route = { page: Page; id?: string; inviteToken?: string };
type ModalState = "create-setlist" | "create-pit" | "join" | "edit-setlist" | null;

function routeFromPath(pathname: string): Route {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/") return { page: "home" };
  if (path === "/explore") return { page: "explore" };
  if (path === "/setlists") return { page: "setlists" };
  if (path.startsWith("/setlists/")) return { page: "setlist-detail", id: decodeURIComponent(path.slice("/setlists/".length)) };
  if (path === "/pits") return { page: "pits" };
  if (path.startsWith("/pits/")) return { page: "pit-room", id: decodeURIComponent(path.slice("/pits/".length)) };
  if (path === "/profile") return { page: "profile" };
  if (path.startsWith("/join/")) return { page: "join", inviteToken: decodeURIComponent(path.slice("/join/".length)) };
  return { page: "home" };
}

function pathForPage(page: Page) {
  if (page === "setlist-detail" || page === "pit-room" || page === "join") return "/";
  return page === "home" ? "/" : `/${page === "profile" ? "profile" : page}`;
}

function idempotencyKey() {
  return window.crypto.randomUUID();
}

export default function App() {
  const [sessionToken, setSessionToken] = useState<string | null>(() => localStorage.getItem(SESSION_STORAGE_KEY));
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [route, setRoute] = useState<Route>(() => routeFromPath(window.location.pathname));
  const [setlists, setSetlists] = useState<Setlist[]>([]);
  const [selectedSetlist, setSelectedSetlist] = useState<Setlist | null>(null);
  const [selectedSetlistItems, setSelectedSetlistItems] = useState<SetlistItem[]>([]);
  const [tracks, setTracks] = useState<TestTrack[]>([]);
  const [pits, setPits] = useState<PitSummary[]>([]);
  const [pitSnapshot, setPitSnapshot] = useState<PitSnapshot | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState("Desconectado");
  const [busy, setBusy] = useState(false);
  const [bootLoading, setBootLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [setlistName, setSetlistName] = useState("");
  const [setlistDescription, setSetlistDescription] = useState("");
  const [pitName, setPitName] = useState("");
  const [pitSourceSetlistId, setPitSourceSetlistId] = useState("");
  const [joinToken, setJoinToken] = useState("");
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const pitSelectionVersion = useRef(0);
  const initialRouteRestored = useRef(false);
  const bootstrapped = useRef(false);

  const api = useCallback(async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
    const headers = new Headers(options.headers);
    if (sessionToken) headers.set("Authorization", `Bearer ${sessionToken}`);
    if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    const response = await fetch(`${API}${path}`, { ...options, headers });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const body = payload as ApiError;
      const message = body.error?.message ?? `La solicitud falló (${response.status}).`;
      throw new Error(message);
    }
    return payload as T;
  }, [sessionToken]);

  const navigate = useCallback((path: string, replace = false) => {
    if (replace) window.history.replaceState({}, "", path);
    else if (`${window.location.pathname}${window.location.search}` !== path) window.history.pushState({}, "", path);
    setRoute(routeFromPath(window.location.pathname));
    setError(null);
  }, []);

  const navigatePage = useCallback((page: Page) => {
    if (page === "pit-room" && pitSnapshot) {
      navigate(`/pits/${pitSnapshot.pit.id}`);
      return;
    }
    navigate(pathForPage(page));
  }, [navigate, pitSnapshot]);

  const refreshSetlists = useCallback(async () => {
    const result = await api<{ setlists: Setlist[] }>("/setlists");
    setSetlists(result.setlists);
    if (selectedSetlist && !result.setlists.some((item) => item.id === selectedSetlist.id)) {
      setSelectedSetlist(null);
      setSelectedSetlistItems([]);
    }
    return result.setlists;
  }, [api, selectedSetlist]);

  const refreshPits = useCallback(async () => {
    const result = await api<{ pits: PitSummary[] }>("/pits");
    setPits(result.pits);
    return result.pits;
  }, [api]);

  const loadSetlist = useCallback(async (setlistId: string, replace = false) => {
    pitSelectionVersion.current += 1;
    const result = await api<{ setlist: Setlist; items: SetlistItem[] }>(`/setlists/${setlistId}`);
    window.sessionStorage.removeItem(ACTIVE_PIT_STORAGE_KEY);
    setPitSnapshot(null);
    setInviteToken(null);
    setInviteLink(null);
    setSelectedSetlist({ ...result.setlist, trackCount: result.items.length });
    setSelectedSetlistItems(result.items);
    navigate(`/setlists/${setlistId}`, replace);
  }, [api, navigate]);

  const loadPit = useCallback(async (pitId: string, replace = false) => {
    const selectionVersion = ++pitSelectionVersion.current;
    const result = await api<PitSnapshot>(`/pits/${pitId}/snapshot`);
    if (selectionVersion !== pitSelectionVersion.current) return;
    window.sessionStorage.setItem(ACTIVE_PIT_STORAGE_KEY, pitId);
    setPitSnapshot(result);
    setSelectedSetlist(null);
    setSelectedSetlistItems([]);
    setInviteToken(null);
    setInviteLink(null);
    navigate(`/pits/${pitId}`, replace);
  }, [api, navigate]);

  const refreshPitSnapshot = useCallback(async (pitId: string) => {
    const selectionVersion = pitSelectionVersion.current;
    const result = await api<PitSnapshot>(`/pits/${pitId}/snapshot`);
    if (selectionVersion !== pitSelectionVersion.current) return;
    if (window.sessionStorage.getItem(ACTIVE_PIT_STORAGE_KEY) !== pitId) return;
    setPitSnapshot((current) => current?.pit.id === pitId ? result : current);
    setPits((current) => current.map((pit) => pit.id === pitId
      ? { ...pit, status: result.pit.status, liveSetRevision: result.liveSet.revision }
      : pit));
  }, [api]);

  const leavePit = useCallback(() => {
    pitSelectionVersion.current += 1;
    window.sessionStorage.removeItem(ACTIVE_PIT_STORAGE_KEY);
    setPitSnapshot(null);
    setInviteToken(null);
    setInviteLink(null);
    navigate("/pits");
  }, [navigate]);

  // Guest identity is recovered from localStorage. A new identity is created only when the token is absent or invalid.
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    void (async () => {
      try {
        let token = localStorage.getItem(SESSION_STORAGE_KEY);
        if (token) {
          try {
            const response = await fetch(`${API}/me`, { headers: { Authorization: `Bearer ${token}` } });
            if (!response.ok) throw new Error("Guest session expired.");
            const result = await response.json() as { identity: Identity };
            setSessionToken(token);
            setIdentity(result.identity);
            return;
          } catch {
            localStorage.removeItem(SESSION_STORAGE_KEY);
            token = null;
          }
        }
        const response = await fetch(`${API}/identity/guest`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
        if (!response.ok) throw new Error("No fue posible crear la identidad guest.");
        const result = await response.json() as { identity: Identity; sessionToken: string };
        localStorage.setItem(SESSION_STORAGE_KEY, result.sessionToken);
        setSessionToken(result.sessionToken);
        setIdentity(result.identity);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "No se pudo iniciar Moshpit.");
      } finally {
        setBootLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!identity) return;
    let cancelled = false;
    Promise.all([
      api<{ setlists: Setlist[] }>("/setlists"),
      api<{ pits: PitSummary[] }>("/pits"),
      api<{ tracks: TestTrack[] }>("/music/test-tracks")
    ]).then(([setlistResult, pitResult, trackResult]) => {
      if (cancelled) return;
      setSetlists(setlistResult.setlists);
      setPits(pitResult.pits);
      setTracks(trackResult.tracks);
    }).catch((cause) => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : "Error cargando Moshpit.");
    });
    return () => { cancelled = true; };
  }, [identity, api]);

  // Restore deep-linked resources after the guest identity has been revalidated.
  useEffect(() => {
    if (!identity || initialRouteRestored.current) return;
    initialRouteRestored.current = true;
    const initial = routeFromPath(window.location.pathname);
    if (initial.page === "pit-room" && initial.id) {
      void loadPit(initial.id, true).catch((cause) => {
        setError(cause instanceof Error ? `No se pudo recuperar el Pit: ${cause.message}` : "No se pudo recuperar el Pit.");
        navigate("/pits", true);
      });
      return;
    }
    if (initial.page === "setlist-detail" && initial.id) {
      void loadSetlist(initial.id, true).catch((cause) => {
        setError(cause instanceof Error ? `No se pudo abrir el Setlist: ${cause.message}` : "No se pudo abrir el Setlist.");
        navigate("/setlists", true);
      });
      return;
    }
    if (initial.page === "join" && initial.inviteToken) setJoinToken(initial.inviteToken);
  }, [identity, loadPit, loadSetlist, navigate]);

  useEffect(() => {
    const onPopState = () => {
      const next = routeFromPath(window.location.pathname);
      setRoute(next);
      if (next.page === "pit-room" && next.id && pitSnapshot?.pit.id !== next.id) {
        void loadPit(next.id, true).catch((cause) => setError(cause instanceof Error ? cause.message : "No se pudo abrir el Pit."));
      } else if (next.page === "setlist-detail" && next.id && selectedSetlist?.id !== next.id) {
        void loadSetlist(next.id, true).catch((cause) => setError(cause instanceof Error ? cause.message : "No se pudo abrir el Setlist."));
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [loadPit, loadSetlist, pitSnapshot?.pit.id, selectedSetlist?.id]);

  // Invitation URLs are first-class navigation: the token is entered only after the guest identity is ready.
  useEffect(() => {
    if (route.page === "join" && route.inviteToken) setJoinToken(route.inviteToken);
  }, [route.page, route.inviteToken]);

  // Connect to Centrifugo only while an active Pit is selected. Events trigger a snapshot refresh; there is no polling loop.
  useEffect(() => {
    const activePit = pitSnapshot;
    if (route.page !== "pit-room" || !route.id || !activePit || activePit.pit.id !== route.id || activePit.pit.status !== "active") {
      setRealtimeStatus("Desconectado");
      return;
    }
    const activePitId = activePit.pit.id;
    let active = true;
    let centrifuge: Centrifuge | null = null;
    let subscription: ReturnType<Centrifuge["newSubscription"]> | null = null;
    async function connect() {
      try {
        const channel = await api<{ token: string; channel: string }>(`/pits/${activePitId}/realtime-token`);
        if (!active) return;
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const realtimeUrl = `${protocol}//${window.location.hostname}:8000/connection/websocket`;
        centrifuge = new Centrifuge(realtimeUrl, {
          getToken: async () => (await api<{ token: string }>("/realtime/connection-token")).token
        });
        subscription = centrifuge.newSubscription(channel.channel, {
          getToken: async () => (await api<{ token: string }>(`/pits/${activePitId}/realtime-token`)).token
        });
        subscription.on("subscribed", () => {
          if (!active) return;
          setRealtimeStatus("Conectado");
          void refreshPitSnapshot(activePitId).catch(() => setRealtimeStatus("Reconectando"));
        });
        subscription.on("unsubscribed", () => { if (active) setRealtimeStatus("Reconectando"); });
        subscription.on("publication", () => { if (active) void refreshPitSnapshot(activePitId).catch(() => setRealtimeStatus("Reconectando")); });
        centrifuge.on("connecting", () => { if (active) setRealtimeStatus("Conectando"); });
        centrifuge.on("disconnected", () => { if (active) setRealtimeStatus("Desconectado"); });
        subscription.subscribe();
        centrifuge.connect();
      } catch {
        if (active) setRealtimeStatus("Realtime no disponible");
      }
    }
    void connect();
    return () => {
      active = false;
      subscription?.unsubscribe();
      centrifuge?.disconnect();
    };
  }, [api, pitSnapshot?.pit.id, pitSnapshot?.pit.status, refreshPitSnapshot, route.page, route.id]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try { await action(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "La operación no se pudo completar."); }
    finally { setBusy(false); }
  }

  async function createSetlist() {
    if (!setlistName.trim()) return;
    await run(async () => {
      const result = await api<{ setlist: Setlist }>("/setlists", {
        method: "POST", headers: { "Idempotency-Key": idempotencyKey() },
        body: JSON.stringify({ name: setlistName.trim(), description: setlistDescription.trim() || null })
      });
      setSetlistName("");
      setSetlistDescription("");
      setModal(null);
      await refreshSetlists();
      await loadSetlist(result.setlist.id);
      setNotice("Setlist creado y guardado en Moshpit.");
    });
  }

  async function updateSetlist() {
    if (!selectedSetlist || !setlistName.trim()) return;
    await run(async () => {
      await api(`/setlists/${selectedSetlist.id}`, {
        method: "PATCH", headers: { "Idempotency-Key": idempotencyKey() },
        body: JSON.stringify({ name: setlistName.trim(), description: setlistDescription.trim() || null, expectedRevision: selectedSetlist.revision })
      });
      setModal(null);
      await refreshSetlists();
      await loadSetlist(selectedSetlist.id);
      setNotice("Setlist actualizado.");
    });
  }

  async function addTrackToSetlist(setlistId: string, trackId: string) {
    await run(async () => {
      const current = setlists.find((item) => item.id === setlistId);
      if (!current) throw new Error("No encontramos ese Setlist.");
      await api(`/setlists/${setlistId}/items`, {
        method: "POST", headers: { "Idempotency-Key": idempotencyKey() },
        body: JSON.stringify({ trackId, expectedRevision: current.revision })
      });
      await refreshSetlists();
      if (selectedSetlist?.id === setlistId) await loadSetlist(setlistId, true);
      setNotice("Canción agregada al Setlist.");
    });
  }

  async function removeSetlistItem(item: SetlistItem) {
    if (!selectedSetlist) return;
    await run(async () => {
      await api(`/setlists/${selectedSetlist.id}/items/${item.itemId}`, {
        method: "DELETE", headers: { "Idempotency-Key": idempotencyKey() },
        body: JSON.stringify({ expectedRevision: selectedSetlist.revision })
      });
      await loadSetlist(selectedSetlist.id, true);
      await refreshSetlists();
    });
  }

  async function moveSetlistItem(item: SetlistItem, direction: -1 | 1) {
    if (!selectedSetlist) return;
    const ordered = [...selectedSetlistItems];
    const index = ordered.findIndex((entry) => entry.itemId === item.itemId);
    const target = index + direction;
    if (target < 0 || target >= ordered.length) return;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    await run(async () => {
      await api(`/setlists/${selectedSetlist.id}/items/reorder`, {
        method: "PATCH", headers: { "Idempotency-Key": idempotencyKey() },
        body: JSON.stringify({ itemIds: ordered.map((entry) => entry.itemId), expectedRevision: selectedSetlist.revision })
      });
      await loadSetlist(selectedSetlist.id, true);
      await refreshSetlists();
    });
  }

  async function createPit() {
    if (!pitName.trim()) return;
    await run(async () => {
      const source = setlists.find((item) => item.id === pitSourceSetlistId) ?? null;
      const result = await api<{ pit: { id: string } }>("/pits", {
        method: "POST", headers: { "Idempotency-Key": idempotencyKey() },
        body: JSON.stringify({ name: pitName.trim(), ...(source ? { setlistId: source.id, sourceSetlistRevision: source.revision } : {}) })
      });
      setPitName("");
      setPitSourceSetlistId("");
      setModal(null);
      await refreshPits();
      await loadPit(result.pit.id);
      setNotice(source ? "Pit creado con una copia independiente del Setlist." : "Pit vacío creado.");
    });
  }

  async function addTrackToPit(pitId: string, trackId: string) {
    await run(async () => {
      const summary = pits.find((pit) => pit.id === pitId);
      if (!summary || summary.status !== "active" || summary.role === "viewer") throw new Error("No tienes permiso para modificar este Live Set.");
      const snapshot = pitSnapshot?.pit.id === pitId ? pitSnapshot : await api<PitSnapshot>(`/pits/${pitId}/snapshot`);
      if (snapshot.membership.role === "viewer") throw new Error("Tu rol Viewer permite únicamente consultar el Live Set.");
      await api(`/pits/${pitId}/live-set/items`, {
        method: "POST", headers: { "Idempotency-Key": idempotencyKey() },
        body: JSON.stringify({ trackId, expectedRevision: snapshot.liveSet.revision })
      });
      if (pitSnapshot?.pit.id === pitId) await refreshPitSnapshot(pitId);
      await refreshPits();
      setNotice("Canción agregada al Live Set.");
    });
  }

  async function addTrackToDestination(track: TestTrack, destination: { type: "setlist" | "pit"; id: string }) {
    if (destination.type === "setlist") await addTrackToSetlist(destination.id, track.id);
    else await addTrackToPit(destination.id, track.id);
  }

  async function addTrackToCurrentLiveSet(trackId: string) {
    if (!pitSnapshot) return;
    const current = pitSnapshot;
    await run(async () => {
      await api(`/pits/${current.pit.id}/live-set/items`, {
        method: "POST", headers: { "Idempotency-Key": idempotencyKey() },
        body: JSON.stringify({ trackId, expectedRevision: current.liveSet.revision })
      });
      await refreshPitSnapshot(current.pit.id);
      await refreshPits();
    });
  }

  async function removeLiveSetItem(item: SetlistItem) {
    if (!pitSnapshot) return;
    const current = pitSnapshot;
    await run(async () => {
      await api(`/pits/${current.pit.id}/live-set/items/${item.itemId}`, {
        method: "DELETE", headers: { "Idempotency-Key": idempotencyKey() },
        body: JSON.stringify({ expectedRevision: current.liveSet.revision })
      });
      await refreshPitSnapshot(current.pit.id);
      await refreshPits();
    });
  }

  async function moveLiveSetItem(item: SetlistItem, direction: -1 | 1) {
    if (!pitSnapshot) return;
    const current = pitSnapshot;
    const ordered = [...current.liveSet.items];
    const index = ordered.findIndex((entry) => entry.itemId === item.itemId);
    const target = index + direction;
    if (target < 0 || target >= ordered.length) return;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    await run(async () => {
      await api(`/pits/${current.pit.id}/live-set/items/reorder`, {
        method: "PATCH", headers: { "Idempotency-Key": idempotencyKey() },
        body: JSON.stringify({ itemIds: ordered.map((entry) => entry.itemId), expectedRevision: current.liveSet.revision })
      });
      await refreshPitSnapshot(current.pit.id);
      await refreshPits();
    });
  }

  async function createInvitation(role: "crowd" | "viewer") {
    if (!pitSnapshot || pitSnapshot.membership.role !== "admin" || pitSnapshot.pit.status !== "active") return;
    await run(async () => {
      const result = await api<{ token: string }>(`/pits/${pitSnapshot.pit.id}/invitations`, {
        method: "POST", headers: { "Idempotency-Key": idempotencyKey() }, body: JSON.stringify({ role })
      });
      setInviteToken(result.token);
      setInviteLink(`${window.location.origin}/join/${result.token}`);
      setNotice(`Invitación de ${role === "crowd" ? "Crowd" : "Viewer"} generada. Vence en 7 días.`);
    });
  }

  async function copyInviteLink() {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setNotice("Enlace de invitación copiado.");
    } catch {
      setError("No pudimos copiar automáticamente. Puedes seleccionar y copiar el enlace desde el cuadro.");
    }
  }

  async function acceptInvitation(token = joinToken) {
    if (!token.trim()) return;
    await run(async () => {
      const result = await api<{ pitId: string }>("/pit-invitations/accept", {
        method: "POST", headers: { "Idempotency-Key": idempotencyKey() }, body: JSON.stringify({ token: token.trim() })
      });
      setJoinToken("");
      setModal(null);
      await refreshPits();
      await loadPit(result.pitId);
      setNotice("Te uniste al Pit.");
    });
  }

  async function endPit() {
    if (!pitSnapshot) return;
    if (!window.confirm("¿Terminar este Pit? Su Live Set quedará conservado en el historial.")) return;
    const current = pitSnapshot;
    await run(async () => {
      await api(`/pits/${current.pit.id}/end`, {
        method: "POST", headers: { "Idempotency-Key": idempotencyKey() },
        body: JSON.stringify({ expectedRevision: current.pit.revision })
      });
      await refreshPitSnapshot(current.pit.id);
      await refreshPits();
      setNotice("Pit finalizado. Su historial quedó guardado.");
    });
  }

  function openSetlistCreate() {
    setSetlistName("");
    setSetlistDescription("");
    setModal("create-setlist");
  }

  function openPitCreate() {
    setPitName("");
    setPitSourceSetlistId(selectedSetlist?.id ?? setlists[0]?.id ?? "");
    setModal("create-pit");
  }

  function openSetlistEdit() {
    if (!selectedSetlist) return;
    setSetlistName(selectedSetlist.name);
    setSetlistDescription(selectedSetlist.description ?? "");
    setModal("edit-setlist");
  }

  function navigateToProfile() {
    navigate("/profile");
  }

  const activePitName = route.page === "pit-room" && pitSnapshot && pitSnapshot.pit.id === route.id ? pitSnapshot.pit.name : undefined;
  const pageContent = (() => {
    if (route.page === "join") {
      return <JoinPage token={route.inviteToken ?? joinToken} busy={busy || bootLoading} error={error} onJoin={(token) => void acceptInvitation(token)} onBack={() => navigate("/")}/>;
    }
    if (route.page === "pit-room") {
      if (pitSnapshot && (!route.id || pitSnapshot.pit.id === route.id)) return <PitRoomPage snapshot={pitSnapshot} tracks={tracks} busy={busy} realtimeStatus={realtimeStatus} inviteToken={inviteToken} onBack={leavePit} onRefresh={() => { if (pitSnapshot) void refreshPitSnapshot(pitSnapshot.pit.id); }} onAddTrack={(id) => void addTrackToCurrentLiveSet(id)} onMoveTrack={(item, direction) => void moveLiveSetItem(item, direction)} onRemoveTrack={(item) => void removeLiveSetItem(item)} onCreateInvitation={(role) => void createInvitation(role)} onCopyInvite={() => void copyInviteLink()} onEndPit={() => void endPit()}/>;
      return <div className="loading-card"><span className="loading-spinner"/><strong>Abriendo Pit…</strong><small>Recuperando la sesión y sus permisos.</small></div>;
    }
    if (route.page === "setlist-detail") {
      if (selectedSetlist && selectedSetlist.id === route.id) return <SetlistDetailPage setlist={selectedSetlist} items={selectedSetlistItems} tracks={tracks} busy={busy} onBack={() => navigate("/setlists")} onExplore={() => navigate("/explore")} onCreatePit={openPitCreate} onEdit={openSetlistEdit} onAddTrack={(id) => void addTrackToSetlist(selectedSetlist.id, id)} onRemoveTrack={(item) => void removeSetlistItem(item)} onMoveTrack={(item, direction) => void moveSetlistItem(item, direction)}/>;
      return <div className="loading-card"><span className="loading-spinner"/><strong>Abriendo Setlist…</strong></div>;
    }
    switch (route.page) {
      case "home": return <HomePage identity={identity} setlists={setlists} pits={pits} onCreateSetlist={openSetlistCreate} onCreatePit={openPitCreate} onExplore={() => navigate("/explore")} onOpenSetlist={(id) => void loadSetlist(id)} onOpenPit={(id) => void loadPit(id)} onOpenPits={() => navigate("/pits")}/>;
      case "explore": return <ExplorePage tracks={tracks} setlists={setlists} pits={pits} onAddTrack={(track, destination) => void addTrackToDestination(track, destination)} onCreateSetlist={openSetlistCreate}/>;
      case "setlists": return <SetlistsPage setlists={setlists} onCreate={openSetlistCreate} onOpen={(id) => void loadSetlist(id)}/>;
      case "pits": return <PitsPage pits={pits} onCreate={openPitCreate} onJoin={() => { setJoinToken(""); setModal("join"); }} onOpen={(id) => void loadPit(id)}/>;
      case "profile": return <ProfilePage identity={identity} onBack={() => navigate("/")}/>;
      default: return <HomePage identity={identity} setlists={setlists} pits={pits} onCreateSetlist={openSetlistCreate} onCreatePit={openPitCreate} onExplore={() => navigate("/explore")} onOpenSetlist={(id) => void loadSetlist(id)} onOpenPit={(id) => void loadPit(id)} onOpenPits={() => navigate("/pits")}/>;
    }
  })();

  return (
    <>
      <AppShell page={route.page} identity={identity} pits={pits} activePitName={activePitName} onNavigate={navigatePage} onSearch={() => navigate("/explore")} onOpenProfile={navigateToProfile} onOpenPit={(id) => void loadPit(id)}>
        {error && <div className="global-feedback feedback-error" role="alert"><Icon name="alert" size={17}/><span>{error}</span><button onClick={() => setError(null)} aria-label="Cerrar"><Icon name="x" size={16}/></button></div>}
        {notice && <div className="global-feedback feedback-success" role="status"><Icon name="check" size={17}/><span>{notice}</span><button onClick={() => setNotice(null)} aria-label="Cerrar"><Icon name="x" size={16}/></button></div>}
        {bootLoading ? <div className="loading-card"><span className="loading-spinner"/><strong>Preparando tu espacio musical…</strong><small>Recuperando tu identidad de Moshpit.</small></div> : pageContent}
        <footer className="app-footer"><span>© MOSHPIT 2026</span><span>MUSIC IS BETTER TOGETHER</span><span>SETLIST → PIT → LIVE SET</span></footer>
      </AppShell>

      <Modal open={modal === "create-setlist"} title="Crear un Setlist" description="Una colección musical que siempre estará en tu biblioteca." onClose={() => setModal(null)}>
        <form className="modal-form" onSubmit={preventSubmit(() => void createSetlist())}>
          <label className="field-label" htmlFor="new-setlist-name">Nombre</label><input id="new-setlist-name" className="form-control" value={setlistName} onChange={(event) => setSetlistName(event.target.value)} placeholder="Ej. Noches de carretera" maxLength={80} autoFocus/>
          <label className="field-label" htmlFor="new-setlist-description">Descripción <span>Opcional</span></label><textarea id="new-setlist-description" className="form-control form-textarea" value={setlistDescription} onChange={(event) => setSetlistDescription(event.target.value)} placeholder="¿Qué une a estas canciones?" maxLength={500}/>
          <FormActions onCancel={() => setModal(null)} submitLabel="Crear Setlist" disabled={busy || !setlistName.trim()}/>
        </form>
      </Modal>

      <Modal open={modal === "edit-setlist"} title="Editar Setlist" description="Actualiza el nombre o la descripción de tu colección." onClose={() => setModal(null)}>
        <form className="modal-form" onSubmit={preventSubmit(() => void updateSetlist())}>
          <label className="field-label" htmlFor="edit-setlist-name">Nombre</label><input id="edit-setlist-name" className="form-control" value={setlistName} onChange={(event) => setSetlistName(event.target.value)} maxLength={80}/>
          <label className="field-label" htmlFor="edit-setlist-description">Descripción <span>Opcional</span></label><textarea id="edit-setlist-description" className="form-control form-textarea" value={setlistDescription} onChange={(event) => setSetlistDescription(event.target.value)} maxLength={500}/>
          <FormActions onCancel={() => setModal(null)} submitLabel="Guardar cambios" disabled={busy || !setlistName.trim()}/>
        </form>
      </Modal>

      <Modal open={modal === "create-pit"} title="Crear un Pit" description="Reúne a tu gente y construyan un Live Set juntos." onClose={() => setModal(null)}>
        <form className="modal-form" onSubmit={preventSubmit(() => void createPit())}>
          <label className="field-label" htmlFor="new-pit-name">Nombre del Pit</label><input id="new-pit-name" className="form-control" value={pitName} onChange={(event) => setPitName(event.target.value)} placeholder="Ej. Sesión del viernes" maxLength={80} autoFocus/>
          <label className="field-label" htmlFor="pit-source-setlist">Empezar desde</label><select id="pit-source-setlist" className="form-control" value={pitSourceSetlistId} onChange={(event) => setPitSourceSetlistId(event.target.value)}><option value="">Un Pit vacío</option>{setlists.map((setlist) => <option value={setlist.id} key={setlist.id}>{setlist.name} · {setlist.trackCount} canciones</option>)}</select>
          <div className="form-helper"><Icon name="info" size={16}/><span>{pitSourceSetlistId ? "Moshpit creará una copia independiente de las canciones del Setlist. El original no cambiará." : "Empiezas con un Live Set vacío y puedes agregar canciones después."}</span></div>
          <FormActions onCancel={() => setModal(null)} submitLabel="Crear Pit" disabled={busy || !pitName.trim()}/>
        </form>
      </Modal>

      <Modal open={modal === "join"} title="Unirme a un Pit" description="Pega el código de invitación que te compartieron." onClose={() => setModal(null)}>
        <form className="modal-form" onSubmit={preventSubmit(() => void acceptInvitation())}>
          <label className="field-label" htmlFor="join-invite-token">Código de invitación</label><input id="join-invite-token" className="form-control" value={joinToken} onChange={(event) => setJoinToken(event.target.value)} placeholder="Código de un solo uso" autoFocus/>
          <div className="form-helper"><Icon name="clock" size={16}/><span>Los códigos son de un solo uso y vencen después de siete días.</span></div>
          <FormActions onCancel={() => setModal(null)} submitLabel="Unirme al Pit" disabled={busy || !joinToken.trim()}/>
        </form>
      </Modal>
    </>
  );
}
