import { useEffect, useMemo, useRef, useState } from "react";
import logoAsset from "@/assets/mec-braba-logo.png.asset.json";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import {
  loginFn,
  registerFn,
  meFn,
  logoutFn,
  listUsersFn,
  approveUserFn,
  rejectUserFn,
  removeUserFn,
  updateUserFn,
  resetPasswordFn,
  saveConfigFn,
  listAnnouncementsFn,
  createAnnouncementFn,
  deleteAnnouncementFn,
  clockPunchFn,
  listMyTimeclockFn,
  listAllTimeclockFn,
  listClientesFn,
  createClienteFn,
  updateClienteFn,
  deleteClienteFn,
  renewClienteBraboFn,
  listSugestoesFn,
  createSugestaoFn,
  updateSugestaoStatusFn,
  deleteSugestaoFn,
  saveQuickTabsFn,
  getQuickTabsFn,
  listBirthdaysFn,
  listChangelogsFn,
  createChangelogFn,
  deleteChangelogFn,
  listOpenTimeclockFn,
  listClienteLogsFn,
  uploadMusicTrackFn,
} from "@/lib/mecbraba.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { useTheme } from "@/hooks/use-theme";
import {
  Minus,
  Plus,
  LogOut,
  Settings,
  Copy,
  RotateCcw,
  Trash2,
  Pencil,
  UserPlus,
  Eye,
  EyeOff,
  Check as CheckIcon,
  X as XIcon,
  KeyRound,
  Menu,
  Home,
  Calculator as CalculatorIcon,
  Clock,
  Users,
  BarChart3,
  Megaphone,
  Sun,
  Moon,
  MessageSquare,
  Send,
  UserCog,
  Search,
  History,
  Music,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  FileText,
  Volume2,
  VolumeX,
  Upload,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";

// ---------- Types & defaults ----------
type Role = "admin" | "mecanico";
type UserStatus = "approved" | "pending";
interface User {
  id: string;
  username: string;
  role: Role;
  status: UserStatus;
  birthday?: string | null;
  display_id?: string | null;
}
interface MecanicoTabsVisibility {
  ponto: boolean;
  clientes: boolean;
  sugestoes: boolean;
  logs: boolean;
}
interface CustomCalcItem {
  id: string;
  nome: string;
  valor: number;
}
interface CustomCalc {
  produtos: CustomCalcItem[];
  atendimentos: CustomCalcItem[];
  pneuZona: CustomCalcItem[];
}
interface MusicTrack {
  id: string;
  nome: string;
  url: string;
}
interface Config {
  margemTunagem: number; // %
  descontoParceria: number; // %
  conserto: { mec: number; sul: number; norte: number };
  reboque: { sul: number; norte: number; explodido: number };
  adicionalKits: { sul: number; norte: number };
  produtos: { chaveInglesa: number; kitBasico: number; kitAvancado: number; pneu: number; ursinho: number };
  pneuZona: number;
  logoUrl?: string;
  mecanicoTabs: MecanicoTabsVisibility;
  customCalc: CustomCalc;
  musicTracks: MusicTrack[];
}

const DEFAULT_CONFIG: Config = {
  margemTunagem: 65,
  descontoParceria: 20,
  conserto: { mec: 1100, sul: 1500, norte: 1900 },
  reboque: { sul: 1100, norte: 1500, explodido: 400 },
  adicionalKits: { sul: 750, norte: 1500 },
  produtos: { chaveInglesa: 2300, kitBasico: 1100, kitAvancado: 3400, pneu: 1100, ursinho: 5000 },
  pneuZona: 1100,
  logoUrl: "",
  mecanicoTabs: { ponto: true, clientes: true, sugestoes: true, logs: true },
  customCalc: { produtos: [], atendimentos: [], pneuZona: [] },
  musicTracks: [],
};

function resolveMecanicoTabs(c: Config): MecanicoTabsVisibility {
  return { ...DEFAULT_CONFIG.mecanicoTabs, ...(c.mecanicoTabs ?? {}) };
}
function resolveCustomCalc(c: Config): CustomCalc {
  const cc = c.customCalc ?? ({} as CustomCalc);
  return {
    produtos: Array.isArray(cc.produtos) ? cc.produtos : [],
    atendimentos: Array.isArray(cc.atendimentos) ? cc.atendimentos : [],
    pneuZona: Array.isArray(cc.pneuZona) ? cc.pneuZona : [],
  };
}
function resolveMusicTracks(c: Config): MusicTrack[] {
  return Array.isArray(c.musicTracks) ? c.musicTracks : [];
}

const LS_TOKEN = "mb_token";
const SS_TOKEN = "mb_token";

function loadToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LS_TOKEN) || sessionStorage.getItem(SS_TOKEN);
}

const brl = (n: number) => "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// All date/time displays in the app must use Brasília time (UTC-3),
// regardless of the user's device timezone.
const BRAZIL_TZ = "America/Sao_Paulo";
const fmtBRDateTime = (d: string | Date) =>
  new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: BRAZIL_TZ });
const fmtBRDate = (d: string | Date) => new Date(d).toLocaleDateString("pt-BR", { timeZone: BRAZIL_TZ });

// Format "Username - ID" when a display_id is present.
function fmtName(username: string, displayId?: string | null): string {
  const id = (displayId ?? "").trim();
  return id ? `${username} - ${id}` : username;
}

type Tab =
  | "home"
  | "calculadora"
  | "ponto"
  | "clientes"
  | "sugestoes"
  | "logs"
  | "perfis"
  | "config"
  | "relatorios"
  | "clientelogs";

function useLogoSrc(config: Config) {
  return config.logoUrl && config.logoUrl.length > 0 ? config.logoUrl : logoAsset.url;
}

// ---------- Main app ----------
export function CalculadoraApp() {
  const [users, setUsers] = useState<User[]>([]);
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [session, setSession] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => loadToken());
  const [loaded, setLoaded] = useState(false);
  const indexRouteApi = getRouteApi("/");
  const search = indexRouteApi.useSearch();
  const navigate = useNavigate();
  const tab: Tab = (search.tab as Tab | undefined) ?? "home";

  function setTabPersist(t: Tab) {
    navigate({ to: "/", search: t === "home" ? {} : { tab: t } });
  }
  function goHome() {
    navigate({ to: "/", search: {} });
  }


  const login_ = useServerFn(loginFn);
  const register_ = useServerFn(registerFn);
  const me_ = useServerFn(meFn);
  const logout_ = useServerFn(logoutFn);
  const listUsers_ = useServerFn(listUsersFn);

  async function refreshUsers(t: string) {
    const res = await listUsers_({ data: { token: t } });
    if (res.users) setUsers(res.users as User[]);
  }

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      const configRes = await supabase.from("app_config").select("data").eq("id", 1).maybeSingle();
      if (cancelled) return;
      if (configRes.data?.data) setConfig({ ...DEFAULT_CONFIG, ...(configRes.data.data as Partial<Config>) });

      const t = loadToken();
      if (t) {
        const { user } = await me_({ data: { token: t } });
        if (cancelled) return;
        if (user) {
          setSession(user as User);
          if (user.role === "admin") await refreshUsers(t);
        } else {
          // expired
          localStorage.removeItem(LS_TOKEN);
          sessionStorage.removeItem(SS_TOKEN);
          setToken(null);
        }
      }
      setLoaded(true);
    }
    bootstrap();

    const channel = supabase
      .channel("mb-config")
      .on("postgres_changes", { event: "*", schema: "public", table: "app_config" }, (payload) => {
        const row = payload.new as { data?: Partial<Config> } | null;
        if (row?.data) setConfig({ ...DEFAULT_CONFIG, ...row.data });
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  async function login(u: string, p: string, rememberMe: boolean) {
    const res = await login_({ data: { username: u, password: p } });
    if ("error" in res) {
      toast.error(res.error);
      return;
    }
    setSession(res.user as User);
    setToken(res.token);
    if (rememberMe) {
      localStorage.setItem(LS_TOKEN, res.token);
      sessionStorage.removeItem(SS_TOKEN);
    } else {
      sessionStorage.setItem(SS_TOKEN, res.token);
      localStorage.removeItem(LS_TOKEN);
    }
    if (res.user.role === "admin") await refreshUsers(res.token);
    toast.success(`Bem-vindo, ${res.user.username}!`);
  }

  async function register(u: string, p: string, birthday: string | null, displayId: string | null) {
    const username = u.trim();
    if (!username || !p) {
      toast.error("Preencha usuário e senha");
      return false;
    }
    const res = await register_({ data: { username, password: p, birthday, display_id: displayId } });
    if ("error" in res) {
      toast.error(res.error);
      return false;
    }
    toast.success("Pedido enviado. Aguarde aprovação do Admin.");
    return true;
  }

  async function logout() {
    if (token) await logout_({ data: { token } }).catch(() => {});
    setSession(null);
    setToken(null);
    goHome();
    localStorage.removeItem(LS_TOKEN);
    sessionStorage.removeItem(SS_TOKEN);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster position="top-center" richColors />
      {!loaded ? (
        <div className="flex min-h-screen items-center justify-center text-muted-foreground">Carregando...</div>
      ) : !session ? (
        <AuthScreen onLogin={login} onRegister={register} config={config} />
      ) : (
        <>
          <Header
            user={session}
            onLogout={logout}
            config={config}
            tab={tab}
            onChangeTab={setTabPersist}
            pendingCount={users.filter((u) => u.status === "pending").length}
          />
          <div className="pb-24">
            <PageRouter
              tab={tab}
              config={config}
              session={session}
              token={token!}
              users={users}
              onUsersChanged={() => token && refreshUsers(token)}
              onConfigChanged={setConfig}
              onChangeTab={setTabPersist}
            />
          </div>
          <MusicPlayer tracks={resolveMusicTracks(config)} />
        </>
      )}
    </div>
  );
}

// ---------- Page router ----------
function PageRouter({
  tab,
  config,
  session,
  token,
  users,
  onUsersChanged,
  onConfigChanged,
  onChangeTab,
}: {
  tab: Tab;
  config: Config;
  session: User;
  token: string;
  users: User[];
  onUsersChanged: () => void;
  onConfigChanged: (config: Config) => void;
  onChangeTab: (t: Tab) => void;
}) {
  const isAdmin = session.role === "admin";
  const mtv = resolveMecanicoTabs(config);
  // Hide tabs deactivated by admin for mecânicos
  if (!isAdmin) {
    if (
      (tab === "ponto" && !mtv.ponto) ||
      (tab === "clientes" && !mtv.clientes) ||
      (tab === "sugestoes" && !mtv.sugestoes) ||
      (tab === "logs" && !mtv.logs)
    ) {
      return <HomePage user={session} config={config} token={token} isAdmin={isAdmin} onChangeTab={onChangeTab} />;
    }
  }
  if (tab === "calculadora") return <Calculator config={config} username={session.username} />;
  if (tab === "ponto") return <PontoPage token={token} />;
  if (tab === "clientes") return <ClientesPage token={token} isAdmin={isAdmin} />;
  if (tab === "sugestoes") return <SugestoesPage token={token} isAdmin={isAdmin} />;
  if (tab === "logs") return <ChangeLogsPage token={token} isAdmin={isAdmin} />;
  if (tab === "perfis" && isAdmin)
    return <PerfisPage token={token} users={users} currentUser={session} onUsersChanged={onUsersChanged} />;
  if (tab === "config" && isAdmin)
    return <ConfigPage token={token} config={config} onConfigChanged={onConfigChanged} />;
  if (tab === "relatorios" && isAdmin) return <RelatoriosPage token={token} />;
  if (tab === "clientelogs" && isAdmin) return <ClienteLogsPage token={token} />;
  return <HomePage user={session} config={config} token={token} isAdmin={isAdmin} onChangeTab={onChangeTab} />;
}

// ---------- Header with hamburger nav ----------
const TABS_MECANICO: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "home", label: "Início", icon: Home },
  { id: "calculadora", label: "Calculadora", icon: CalculatorIcon },
  { id: "ponto", label: "Ponto", icon: Clock },
  { id: "clientes", label: "Clientes", icon: UserCog },
  { id: "sugestoes", label: "Sugestões", icon: MessageSquare },
  { id: "logs", label: "Change Logs", icon: History },
];
const TABS_ADMIN: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "perfis", label: "Gestão de Perfis", icon: Users },
  { id: "config", label: "Configurações", icon: Settings },
  { id: "relatorios", label: "Relatórios", icon: BarChart3 },
  { id: "clientelogs", label: "Logs de Clientes", icon: FileText },
];

function Header({
  user,
  onLogout,
  config,
  tab,
  onChangeTab,
  pendingCount,
}: {
  user: User;
  onLogout: () => void;
  config: Config;
  tab: Tab;
  onChangeTab: (t: Tab) => void;
  pendingCount: number;
}) {
  const [open, setOpen] = useState(false);
  const logoSrc = useLogoSrc(config);
  const mtv = resolveMecanicoTabs(config);
  const mecanicoVisible = TABS_MECANICO.filter((t) => {
    if (t.id === "ponto") return mtv.ponto;
    if (t.id === "clientes") return mtv.clientes;
    if (t.id === "sugestoes") return mtv.sugestoes;
    if (t.id === "logs") return mtv.logs;
    return true; // home, calculadora always
  });
  const isAdmin = user.role === "admin";
  const items: Array<{ id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }> = isAdmin
    ? [...TABS_MECANICO, ...TABS_ADMIN]
    : mecanicoVisible;
  return (
    <header className="border-b-2 border-primary/40 bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-5 sm:py-6">
        <div className="flex items-center gap-4">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative h-12 w-12 text-primary hover:bg-primary/10"
                aria-label="Abrir menu"
              >
                <Menu className="h-7 w-7" />
                {pendingCount > 0 && user.role === "admin" && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                    {pendingCount}
                  </span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 border-r-2 border-primary/40 bg-card p-0 text-foreground">
              <SheetHeader className="border-b border-primary/30 p-4">
                <div className="flex items-center gap-3">
                  <img src={logoSrc} alt="Mecânica Braba" className="h-12 w-auto" />
                  <SheetTitle className="text-primary">Mec. BRABA</SheetTitle>
                </div>
              </SheetHeader>
              <nav className="flex flex-col p-2">
                {isAdmin ? (
                  <>
                    <SidebarLabel>Mecânico</SidebarLabel>
                    {TABS_MECANICO.map((it) => (
                      <SidebarItem
                        key={it.id}
                        item={it}
                        active={tab === it.id}
                        pendingCount={it.id === "perfis" ? pendingCount : 0}
                        onClick={() => {
                          onChangeTab(it.id);
                          setOpen(false);
                        }}
                      />
                    ))}
                    <SidebarLabel className="mt-2">Admin</SidebarLabel>
                    {TABS_ADMIN.map((it) => (
                      <SidebarItem
                        key={it.id}
                        item={it}
                        active={tab === it.id}
                        pendingCount={it.id === "perfis" ? pendingCount : 0}
                        onClick={() => {
                          onChangeTab(it.id);
                          setOpen(false);
                        }}
                      />
                    ))}
                  </>
                ) : (
                  items.map((it) => (
                    <SidebarItem
                      key={it.id}
                      item={it}
                      active={tab === it.id}
                      pendingCount={0}
                      onClick={() => {
                        onChangeTab(it.id);
                        setOpen(false);
                      }}
                    />
                  ))
                )}
                <div className="my-3 h-px bg-primary/20" />
                <button
                  onClick={() => {
                    setOpen(false);
                    onLogout();
                  }}
                  className="flex items-center gap-3 rounded-md px-3 py-3 text-left text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <LogOut className="h-5 w-5" /> Sair
                </button>
                <div className="my-3 h-px bg-primary/20" />
                <ThemeToggleMenuItem />
              </nav>
            </SheetContent>
          </Sheet>
          <img src={logoSrc} alt="Mecânica Braba" className="h-14 w-auto sm:h-16" />
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right text-xs sm:text-sm">
            <div className="text-base font-semibold text-primary sm:text-lg">
              {fmtName(user.username, user.display_id)}
            </div>
            <div className="text-muted-foreground">{user.role === "admin" ? "Admin" : "Mecânico"}</div>
          </div>
        </div>
      </div>
    </header>
  );
}

function SidebarLabel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-widest text-primary/70 ${className}`}>
      {children}
    </div>
  );
}

function SidebarItem({
  item,
  active,
  pendingCount,
  onClick,
}: {
  item: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> };
  active: boolean;
  pendingCount: number;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-3 rounded-md px-3 py-3 text-left text-sm font-medium transition ${
        active
          ? "bg-primary text-primary-foreground shadow-[var(--shadow-brand)]"
          : "text-foreground hover:bg-primary/10 hover:text-primary"
      }`}
    >
      <Icon className="h-5 w-5" />
      {item.label}
      {pendingCount > 0 && (
        <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
          {pendingCount}
        </span>
      )}
    </button>
  );
}

// ---------- Password input with eye toggle ----------
function PasswordInput({
  id,
  value,
  onChange,
  placeholder,
  autoFocus,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="pr-10"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-primary"
        aria-label={show ? "Ocultar senha" : "Mostrar senha"}
        tabIndex={-1}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

// ---------- Auth (login + register) ----------
function AuthScreen({
  onLogin,
  onRegister,
  config,
}: {
  onLogin: (u: string, p: string, rememberMe: boolean) => void | Promise<void>;
  onRegister: (u: string, p: string, birthday: string | null, displayId: string | null) => boolean | Promise<boolean>;
  config: Config;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [birthday, setBirthday] = useState("");
  const [displayId, setDisplayId] = useState("");
  const [rememberMe, setRememberMe] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "login") onLogin(u.trim(), p, rememberMe);
    else {
      const ok = await onRegister(u, p, birthday || null, displayId.trim() || null);
      if (ok) {
        setMode("login");
        setP("");
        setBirthday("");
        setDisplayId("");
      }
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm border-primary/30 bg-card/80 p-8 shadow-[0_0_60px_-10px_rgba(255,105,180,0.4)]">
        <img
          src={useLogoSrc(config)}
          alt="Mecânica Braba"
          className="mx-auto mb-6 h-24 w-auto drop-shadow-[0_0_25px_rgba(255,105,180,0.55)]"
        />
        {mode === "register" && <h1 className="mb-1 text-center text-2xl font-bold tracking-tight">Criar conta</h1>}
        <p className="mb-6 text-center text-sm text-muted-foreground">
          {mode === "login" ? "Acesso restrito à equipe" : "Sua conta fica pendente até o Admin aprovar"}
        </p>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="u">Usuário</Label>
            <Input id="u" value={u} onChange={(e) => setU(e.target.value)} placeholder="Ex: Dianne Nayar" autoFocus />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p">Senha</Label>
            <PasswordInput id="p" value={p} onChange={setP} />
          </div>
          {mode === "register" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="did">ID (Passaporte)</Label>
                <Input id="did" value={displayId} onChange={(e) => setDisplayId(e.target.value)} maxLength={60} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bday">Data de Aniversário</Label>
                <Input id="bday" type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} />
              </div>
            </>
          )}
          {mode === "login" && (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
              <Checkbox checked={rememberMe} onCheckedChange={(v) => setRememberMe(Boolean(v))} />
              Lembrar de mim
            </label>
          )}
          <Button
            type="submit"
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-[var(--shadow-brand)]"
          >
            {mode === "login" ? "Entrar" : "Pedir registro"}
          </Button>
        </form>
        <button
          type="button"
          onClick={() => {
            setMode(mode === "login" ? "register" : "login");
            setP("");
          }}
          className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-primary"
        >
          {mode === "login" ? "Não tem conta? Crie uma" : "Já tem uma conta? Entrar"}
        </button>
      </Card>
    </div>
  );
}

// ---------- Calculator ----------
interface CalcState {
  tunagemBase: number;
  conserto: { mec: boolean; sul: boolean; norte: boolean };
  reboque: { sul: boolean; norte: boolean; explodido: boolean };
  adicionalKits: { sul: boolean; norte: boolean };
  produtos: { chaveInglesa: number; kitBasico: number; kitAvancado: number; pneu: number; ursinho: number };
  pneuZona: { mec: number; sul: number; norte: number };
  parceria: boolean;
  // Custom items keyed by item id
  customProdutos: Record<string, number>;
  customAtend: Record<string, boolean>;
  customPneuZona: Record<string, number>;
}
const EMPTY: CalcState = {
  tunagemBase: 0,
  conserto: { mec: false, sul: false, norte: false },
  reboque: { sul: false, norte: false, explodido: false },
  adicionalKits: { sul: false, norte: false },
  produtos: { chaveInglesa: 0, kitBasico: 0, kitAvancado: 0, pneu: 0, ursinho: 0 },
  pneuZona: { mec: 0, sul: 0, norte: 0 },
  parceria: false,
  customProdutos: {},
  customAtend: {},
  customPneuZona: {},
};

function Calculator({ config, username }: { config: Config; username: string }) {
  const [s, setS] = useState<CalcState>(EMPTY);

  const tunagemTotal = useMemo(
    () => s.tunagemBase + s.tunagemBase * (config.margemTunagem / 100),
    [s.tunagemBase, config.margemTunagem],
  );

  const cc = resolveCustomCalc(config);

  const totalAtendimentos = useMemo(() => {
    let t = 0;
    if (s.conserto.mec) t += config.conserto.mec;
    if (s.conserto.sul) t += config.conserto.sul;
    if (s.conserto.norte) t += config.conserto.norte;
    if (s.reboque.sul) t += config.reboque.sul;
    if (s.reboque.norte) t += config.reboque.norte;
    if (s.reboque.explodido) t += config.reboque.explodido;
    if (s.adicionalKits.sul) t += config.adicionalKits.sul;
    if (s.adicionalKits.norte) t += config.adicionalKits.norte;
    for (const it of cc.atendimentos) if (s.customAtend[it.id]) t += it.valor;
    return t;
  }, [s.conserto, s.reboque, s.adicionalKits, s.customAtend, config, cc.atendimentos]);

  const totalProdutos = useMemo(() => {
    const p = s.produtos,
      c = config.produtos;
    let t =
      p.chaveInglesa * c.chaveInglesa +
      p.kitBasico * c.kitBasico +
      p.kitAvancado * c.kitAvancado +
      p.pneu * c.pneu +
      p.ursinho * c.ursinho;
    for (const it of cc.produtos) t += (s.customProdutos[it.id] ?? 0) * it.valor;
    return t;
  }, [s.produtos, s.customProdutos, config.produtos, cc.produtos]);

  const totalPneuZona = useMemo(() => {
    let t = (s.pneuZona.mec + s.pneuZona.sul + s.pneuZona.norte) * config.pneuZona;
    for (const it of cc.pneuZona) t += (s.customPneuZona[it.id] ?? 0) * it.valor;
    return t;
  }, [s.pneuZona, s.customPneuZona, config.pneuZona, cc.pneuZona]);

  const totalGeral = tunagemTotal + totalAtendimentos + totalProdutos + totalPneuZona;
  const totalParceria = totalGeral - totalGeral * (config.descontoParceria / 100);

  function reset() {
    setS(EMPTY);
    toast.success("Calculadora limpa!");
  }

  function copiarResumo() {
    const linhas: string[] = [];
    const data = new Date();
    const dataStr = data.toLocaleDateString("pt-BR", { timeZone: BRAZIL_TZ });
    const horaStr = data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: BRAZIL_TZ });

    linhas.push("🔧 *MECÂNICA BRABA — RESUMO DE SERVIÇO* 🔧");
    linhas.push(`📅 ${dataStr}  •  🕒 ${horaStr}`);
    linhas.push(`👤 Mecânico: ${username}`);
    linhas.push("━━━━━━━━━━━━━━━━━━━━━━");

    if (s.tunagemBase > 0) {
      linhas.push("\n🎨 *ESTÉTICA & TUNAGEM*");
      linhas.push(`  • Base: ${brl(s.tunagemBase)}`);
      linhas.push(`  • Margem (+${config.margemTunagem}%): ${brl(tunagemTotal - s.tunagemBase)}`);
      linhas.push(`  • Subtotal: ${brl(tunagemTotal)}`);
    }

    const atend: string[] = [];
    if (s.conserto.mec) atend.push(`  • Conserto MEC: ${brl(config.conserto.mec)}`);
    if (s.conserto.sul) atend.push(`  • Conserto SUL: ${brl(config.conserto.sul)}`);
    if (s.conserto.norte) atend.push(`  • Conserto NORTE: ${brl(config.conserto.norte)}`);
    if (s.reboque.sul) atend.push(`  • Reboque SUL: ${brl(config.reboque.sul)}`);
    if (s.reboque.norte) atend.push(`  • Reboque NORTE: ${brl(config.reboque.norte)}`);
    if (s.reboque.explodido) atend.push(`  • Reboque Carro Explodido: ${brl(config.reboque.explodido)}`);
    if (s.adicionalKits.sul) atend.push(`  • Adicional Kits SUL: ${brl(config.adicionalKits.sul)}`);
    if (s.adicionalKits.norte) atend.push(`  • Adicional Kits NORTE: ${brl(config.adicionalKits.norte)}`);
    for (const it of cc.atendimentos) if (s.customAtend[it.id]) atend.push(`  • ${it.nome}: ${brl(it.valor)}`);
    if (atend.length) {
      linhas.push("\n🛠️ *ATENDIMENTOS*");
      linhas.push(...atend);
      linhas.push(`  • Subtotal: ${brl(totalAtendimentos)}`);
    }

    const prods: string[] = [];
    const pl: [number, string, number][] = [
      [s.produtos.chaveInglesa, "Chave Inglesa", config.produtos.chaveInglesa],
      [s.produtos.kitBasico, "Kit Básico", config.produtos.kitBasico],
      [s.produtos.kitAvancado, "Kit Avançado", config.produtos.kitAvancado],
      [s.produtos.pneu, "Pneu", config.produtos.pneu],
      [s.produtos.ursinho, "Ursinho", config.produtos.ursinho],
    ];
    pl.forEach(([q, n, v]) => {
      if (q > 0) prods.push(`  • ${n} x${q}: ${brl(q * v)}`);
    });
    for (const it of cc.produtos) {
      const q = s.customProdutos[it.id] ?? 0;
      if (q > 0) prods.push(`  • ${it.nome} x${q}: ${brl(q * it.valor)}`);
    }
    if (prods.length) {
      linhas.push("\n📦 *PRODUTOS*");
      linhas.push(...prods);
      linhas.push(`  • Subtotal: ${brl(totalProdutos)}`);
    }

    const pz: string[] = [];
    if (s.pneuZona.mec > 0) pz.push(`  • MEC x${s.pneuZona.mec}: ${brl(s.pneuZona.mec * config.pneuZona)}`);
    if (s.pneuZona.sul > 0) pz.push(`  • SUL x${s.pneuZona.sul}: ${brl(s.pneuZona.sul * config.pneuZona)}`);
    if (s.pneuZona.norte > 0) pz.push(`  • NORTE x${s.pneuZona.norte}: ${brl(s.pneuZona.norte * config.pneuZona)}`);
    for (const it of cc.pneuZona) {
      const q = s.customPneuZona[it.id] ?? 0;
      if (q > 0) pz.push(`  • ${it.nome} x${q}: ${brl(q * it.valor)}`);
    }
    if (pz.length) {
      linhas.push("\n🛞 *PNEU POR ZONA*");
      linhas.push(...pz);
      linhas.push(`  • Subtotal: ${brl(totalPneuZona)}`);
    }

    linhas.push("\n━━━━━━━━━━━━━━━━━━━━━━");
    linhas.push(`💰 *TOTAL GERAL:* ${brl(totalGeral)}`);
    if (s.parceria) {
      linhas.push(`🤝 *Parceria (-${config.descontoParceria}%):* ${brl(totalParceria)}`);
    }
    linhas.push("━━━━━━━━━━━━━━━━━━━━━━");

    const texto = linhas.join("\n");
    navigator.clipboard.writeText(texto).then(
      () => toast.success("Resumo copiado!"),
      () => toast.error("Não foi possível copiar"),
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 pb-64">
      <div className="grid gap-6 md:grid-cols-2">
        {/* Estética & Tunagem */}
        <Section title="🎨 Estética & Tunagem">
          <div className="space-y-3">
            <Label>Valor base</Label>
            <Input
              type="number"
              min={0}
              value={s.tunagemBase || ""}
              onChange={(e) => setS({ ...s, tunagemBase: Number(e.target.value) || 0 })}
              placeholder="0"
            />
            <div className="grid grid-cols-2 gap-2 text-sm">
              <Stat label={`+${config.margemTunagem}%`} value={brl(tunagemTotal - s.tunagemBase)} />
              <Stat label="Total" value={brl(tunagemTotal)} highlight />
            </div>
          </div>
        </Section>

        {/* Atendimentos */}
        <Section title="🛠️ Atendimentos">
          <Group title="Conserto">
            <Check
              label={`MEC — ${brl(config.conserto.mec)}`}
              checked={s.conserto.mec}
              onChange={(v) => setS({ ...s, conserto: { ...s.conserto, mec: v } })}
            />
            <Check
              label={`SUL — ${brl(config.conserto.sul)}`}
              checked={s.conserto.sul}
              onChange={(v) => setS({ ...s, conserto: { ...s.conserto, sul: v } })}
            />
            <Check
              label={`NORTE — ${brl(config.conserto.norte)}`}
              checked={s.conserto.norte}
              onChange={(v) => setS({ ...s, conserto: { ...s.conserto, norte: v } })}
            />
          </Group>
          <Group title="Reboque">
            <Check
              label={`SUL — ${brl(config.reboque.sul)}`}
              checked={s.reboque.sul}
              onChange={(v) => setS({ ...s, reboque: { ...s.reboque, sul: v } })}
            />
            <Check
              label={`NORTE — ${brl(config.reboque.norte)}`}
              checked={s.reboque.norte}
              onChange={(v) => setS({ ...s, reboque: { ...s.reboque, norte: v } })}
            />
            <Check
              label={`Carro Explodido — ${brl(config.reboque.explodido)}`}
              checked={s.reboque.explodido}
              onChange={(v) => setS({ ...s, reboque: { ...s.reboque, explodido: v } })}
            />
          </Group>
          <Group title="Adicional Venda p/ Kits">
            <Check
              label={`SUL — ${brl(config.adicionalKits.sul)}`}
              checked={s.adicionalKits.sul}
              onChange={(v) => setS({ ...s, adicionalKits: { ...s.adicionalKits, sul: v } })}
            />
            <Check
              label={`NORTE — ${brl(config.adicionalKits.norte)}`}
              checked={s.adicionalKits.norte}
              onChange={(v) => setS({ ...s, adicionalKits: { ...s.adicionalKits, norte: v } })}
            />
          </Group>
          {cc.atendimentos.length > 0 && (
            <Group title="Outros">
              {cc.atendimentos.map((it) => (
                <Check
                  key={it.id}
                  label={`${it.nome} — ${brl(it.valor)}`}
                  checked={!!s.customAtend[it.id]}
                  onChange={(v) => setS({ ...s, customAtend: { ...s.customAtend, [it.id]: v } })}
                />
              ))}
            </Group>
          )}
          <div className="mt-2 border-t border-border/40 pt-2 text-right text-sm text-muted-foreground">
            Subtotal: <span className="font-semibold text-primary">{brl(totalAtendimentos)}</span>
          </div>
        </Section>

        {/* Produtos */}
        <Section title="📦 Produtos">
          <Stepper
            label="Chave Inglesa"
            price={config.produtos.chaveInglesa}
            value={s.produtos.chaveInglesa}
            onChange={(v) => setS({ ...s, produtos: { ...s.produtos, chaveInglesa: v } })}
          />
          <Stepper
            label="Kit Básico"
            price={config.produtos.kitBasico}
            value={s.produtos.kitBasico}
            onChange={(v) => setS({ ...s, produtos: { ...s.produtos, kitBasico: v } })}
          />
          <Stepper
            label="Kit Avançado"
            price={config.produtos.kitAvancado}
            value={s.produtos.kitAvancado}
            onChange={(v) => setS({ ...s, produtos: { ...s.produtos, kitAvancado: v } })}
          />
          <Stepper
            label="Pneu"
            price={config.produtos.pneu}
            value={s.produtos.pneu}
            onChange={(v) => setS({ ...s, produtos: { ...s.produtos, pneu: v } })}
          />
          <Stepper
            label="Ursinho"
            price={config.produtos.ursinho}
            value={s.produtos.ursinho}
            onChange={(v) => setS({ ...s, produtos: { ...s.produtos, ursinho: v } })}
          />
          {cc.produtos.map((it) => (
            <Stepper
              key={it.id}
              label={it.nome}
              price={it.valor}
              value={s.customProdutos[it.id] ?? 0}
              onChange={(v) => setS({ ...s, customProdutos: { ...s.customProdutos, [it.id]: v } })}
            />
          ))}
          <div className="mt-2 border-t border-border/40 pt-2 text-right text-sm text-muted-foreground">
            Subtotal: <span className="font-semibold text-primary">{brl(totalProdutos)}</span>
          </div>
        </Section>

        {/* Pneu por Zona */}
        <Section title="🛞 Pneu por Zona">
          <p className="text-xs text-muted-foreground">Cada pneu: {brl(config.pneuZona)}</p>
          {(["mec", "sul", "norte"] as const).map((z) => (
            <Stepper
              key={z}
              label={z.toUpperCase()}
              price={config.pneuZona}
              value={s.pneuZona[z]}
              onChange={(v) => setS({ ...s, pneuZona: { ...s.pneuZona, [z]: v } })}
            />
          ))}
          {cc.pneuZona.map((it) => (
            <Stepper
              key={it.id}
              label={it.nome}
              price={it.valor}
              value={s.customPneuZona[it.id] ?? 0}
              onChange={(v) => setS({ ...s, customPneuZona: { ...s.customPneuZona, [it.id]: v } })}
            />
          ))}
          <div className="mt-2 border-t border-border/40 pt-2 text-right text-sm text-muted-foreground">
            Subtotal: <span className="font-semibold text-primary">{brl(totalPneuZona)}</span>
          </div>
        </Section>
      </div>

      {/* Totais sticky */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-primary/30 bg-card/95 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-3">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-1.5 text-sm">
              <Checkbox checked={s.parceria} onCheckedChange={(v) => setS({ ...s, parceria: Boolean(v) })} />
              <span className="font-medium">Cliente com Parceria</span>
            </label>
          </div>
          <div className={`grid gap-3 ${s.parceria ? "sm:grid-cols-2" : "sm:grid-cols-1"}`}>
            <TotalCard label="Total Geral" value={brl(totalGeral)} highlight />
            {s.parceria && <TotalCard label={`Parceria −${config.descontoParceria}%`} value={brl(totalParceria)} />}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              onClick={copiarResumo}
              className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 shadow-[var(--shadow-brand)]"
            >
              <Copy className="h-4 w-4" /> Copiar Resumo
            </Button>
            <Button onClick={reset} variant="outline" className="border-primary/50 text-primary hover:bg-primary/10">
              <RotateCcw className="h-4 w-4" /> Limpar Tudo
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}

// ---------- Small UI helpers ----------
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="border-primary/20 bg-card/60 p-5 backdrop-blur">
      <h2 className="mb-4 text-lg font-bold text-primary">{title}</h2>
      <div className="space-y-3">{children}</div>
    </Card>
  );
}
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border/40 bg-background/40 p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-sm p-1 hover:bg-primary/5">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(Boolean(v))} />
      <span className="text-sm">{label}</span>
    </label>
  );
}
function Stepper({
  label,
  price,
  value,
  onChange,
}: {
  label: string;
  price: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border/40 bg-background/40 p-2">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{brl(price)}</div>
      </div>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-8 w-8 border-primary/40 text-primary hover:bg-primary/10"
          onClick={() => onChange(Math.max(0, value - 1))}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <Input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={value}
          onChange={(e) => {
            const raw = e.target.value.replace(/\D/g, "");
            const n = raw === "" ? 0 : parseInt(raw, 10);
            onChange(Math.max(0, isNaN(n) ? 0 : n));
          }}
          className="h-8 w-14 px-1 text-center font-semibold tabular-nums"
        />
        <Button
          type="button"
          size="icon"
          className="h-8 w-8 bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={() => onChange(value + 1)}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={`rounded-md border p-2 ${highlight ? "border-primary/60 bg-primary/10" : "border-border/40 bg-background/40"}`}
    >
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`font-bold ${highlight ? "text-primary" : ""}`}>{value}</div>
    </div>
  );
}
function TotalCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={`rounded-md border p-3 ${highlight ? "border-primary bg-primary/15 shadow-[var(--shadow-brand)]" : "border-border/40 bg-background/40"}`}
    >
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-xl font-bold tabular-nums ${highlight ? "text-primary" : ""}`}>{value}</div>
    </div>
  );
}

// ---------- Page wrapper ----------
function PageShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="mb-5 text-2xl font-bold tracking-tight text-primary">{title}</h1>
      {children}
    </main>
  );
}

// ---------- Home page ----------
interface Announcement {
  id: string;
  title: string;
  body: string;
  created_at: string;
  expires_at: string | null;
}

function HomePage({
  user,
  config,
  token,
  isAdmin,
  onChangeTab,
}: {
  user: User;
  config: Config;
  token: string;
  isAdmin: boolean;
  onChangeTab: (t: Tab) => void;
}) {
  const logoSrc = useLogoSrc(config);
  const [now, setNow] = useState(() => new Date());
  const [items, setItems] = useState<Announcement[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [birthdays, setBirthdays] = useState<
    Array<{ id: string; username: string; birthday: string | null; display_id: string | null }>
  >([]);
  const [openWorkers, setOpenWorkers] = useState<
    Array<{ id: string; user_id: string; entry_at: string; username: string; display_id: string | null }>
  >([]);
  const list_ = useServerFn(listAnnouncementsFn);
  const listClientes_ = useServerFn(listClientesFn);
  const listBirthdays_ = useServerFn(listBirthdaysFn);
  const listOpenTC_ = useServerFn(listOpenTimeclockFn);
  const saveQuick_ = useServerFn(saveQuickTabsFn);
  const getQuick_ = useServerFn(getQuickTabsFn);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await list_({ data: { token } });
      if (!cancelled) setItems((res.items ?? []) as Announcement[]);
    }
    load();
    const channel = supabase
      .channel("mb-ann")
      .on("postgres_changes", { event: "*", schema: "public", table: "app_announcements" }, load)
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [list_]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await listClientes_({ data: { token } });
      if (!cancelled) setClientes((res.items ?? []) as Cliente[]);
    }
    load();
  }, [listClientes_, token]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await listOpenTC_({ data: { token } });
      if (!cancelled) setOpenWorkers(res.items ?? []);
    }
    load();
    const channel = supabase
      .channel("mb-tc-open")
      .on("postgres_changes", { event: "*", schema: "public", table: "app_timeclock" }, load)
      .subscribe();
    const t = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(t);
      supabase.removeChannel(channel);
    };
  }, [listOpenTC_, token]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await listBirthdays_({ data: { token } });
      if (!cancelled) setBirthdays(res.users ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [listBirthdays_, token]);

  const dateStr = now.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: BRAZIL_TZ,
  });
  const timeStr = now.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: BRAZIL_TZ,
  });

  // Today's birthday people (Brasília tz, month-day match)
  const todayMD = new Intl.DateTimeFormat("en-CA", { timeZone: BRAZIL_TZ, month: "2-digit", day: "2-digit" }).format(
    now,
  );
  const birthdayToday = birthdays.filter((u) => {
    if (!u.birthday) return false;
    // birthday stored as YYYY-MM-DD
    const md = u.birthday.slice(5);
    return md === todayMD;
  });
  const isMyBirthday = birthdayToday.some((u) => u.id === user.id);

  const expiringSoon = clientes
    .map((c) => {
      if (!c.cliente_brabo_expira) return null;
      const ms = new Date(c.cliente_brabo_expira).getTime() - now.getTime();
      const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
      return ms > 0 && days <= 5 ? { c, days } : null;
    })
    .filter((x): x is { c: Cliente; days: number } => x !== null)
    .sort((a, b) => a.days - b.days);

  const mtv = resolveMecanicoTabs(config);
  const availableTabs: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "calculadora", label: "Calculadora", icon: CalculatorIcon },
    ...(isAdmin || mtv.ponto ? [{ id: "ponto" as Tab, label: "Ponto", icon: Clock }] : []),
    ...(isAdmin || mtv.clientes ? [{ id: "clientes" as Tab, label: "Clientes", icon: UserCog }] : []),
    ...(isAdmin || mtv.sugestoes ? [{ id: "sugestoes" as Tab, label: "Sugestões", icon: MessageSquare }] : []),
    ...(isAdmin || mtv.logs ? [{ id: "logs" as Tab, label: "Change Logs", icon: History }] : []),
    ...(isAdmin
      ? [
          { id: "perfis" as Tab, label: "Gestão de Perfis", icon: Users },
          { id: "config" as Tab, label: "Configurações", icon: Settings },
          { id: "relatorios" as Tab, label: "Relatórios", icon: BarChart3 },
        ]
      : []),
  ];
  const availableIds = availableTabs.map((t) => t.id);

  const [editingQuick, setEditingQuick] = useState(false);
  const [selectedQuick, setSelectedQuick] = useState<Tab[] | null>(null);

  // Load preferences from cloud (per-user, persistent across devices)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await getQuick_({ data: { token } });
      if (cancelled) return;
      if (res.tabs && Array.isArray(res.tabs)) setSelectedQuick(res.tabs as Tab[]);
      else setSelectedQuick(availableIds);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getQuick_, token]);

  const currentSelection = selectedQuick ?? availableIds;
  const effectiveSelected = currentSelection.filter((id) => availableIds.includes(id));
  const quickTabs = (effectiveSelected.length > 0 ? effectiveSelected : availableIds)
    .map((id) => availableTabs.find((t) => t.id === id))
    .filter((t): t is { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> } => !!t);

  function toggleQuick(id: Tab) {
    setSelectedQuick((prev) => {
      const base = prev ?? availableIds;
      const has = base.includes(id);
      const next = has ? base.filter((x) => x !== id) : [...base, id];
      // Persist to cloud (fire-and-forget)
      saveQuick_({ data: { token, tabs: next as string[] } }).catch(() => {});
      return next;
    });
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      {isMyBirthday && <BirthdayBalloons />}
      <Card className="border-primary/40 bg-card/70 p-8 shadow-[0_0_60px_-20px_rgba(255,105,180,0.5)] sm:p-12">
        <div className="text-center">
          <img
            src={logoSrc}
            alt="Mecânica Braba"
            className="mx-auto mb-6 h-40 w-auto drop-shadow-[0_0_25px_rgba(255,105,180,0.6)] sm:h-48"
          />
          {isMyBirthday ? (
            <>
              <div className="mb-3 text-5xl sm:text-6xl">🎉🎂🎈</div>
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-5xl">
                <span className="bg-gradient-to-r from-primary via-pink-400 to-primary bg-clip-text text-transparent drop-shadow-[0_0_25px_rgba(255,105,180,0.8)]">
                  Parabéns, {user.username}!
                </span>
              </h2>
              <p className="mt-3 text-base font-semibold text-primary sm:text-lg">
                Toda a equipa Mecânica Braba te deseja um dia incrível! 🎁
              </p>
            </>
          ) : (
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Bem-vindo, <span className="text-primary">{user.username}</span>!
            </h2>
          )}
          <p className="mt-3 text-sm uppercase tracking-wide text-muted-foreground sm:text-base">{dateStr}</p>
          <p className="text-4xl font-bold tabular-nums text-primary sm:text-5xl">{timeStr}</p>
          <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">Horário de Brasília (UTC−3)</p>
        </div>

        {birthdayToday.length > 0 && !isMyBirthday && (
          <section className="mt-8 rounded-lg border-2 border-primary/60 bg-gradient-to-r from-primary/15 via-pink-500/10 to-primary/15 p-5 text-center">
            <div className="text-3xl">🎂🎉</div>
            <h3 className="mt-2 text-lg font-bold text-primary">
              Hoje é aniversário de {birthdayToday.map((b) => fmtName(b.username, b.display_id)).join(", ")}!
            </h3>
            <p className="mt-1 text-sm text-foreground">Manda os parabéns! 🎈</p>
          </section>
        )}

        {birthdayToday.length > 1 && isMyBirthday && (
          <section className="mt-8 rounded-lg border-2 border-primary/60 bg-primary/10 p-4 text-center">
            <p className="text-sm">
              Também fazem anos hoje:{" "}
              <span className="font-bold text-primary">
                {birthdayToday
                  .filter((b) => b.id !== user.id)
                  .map((b) => fmtName(b.username, b.display_id))
                  .join(", ")}
              </span>
            </p>
          </section>
        )}

        {expiringSoon.length > 0 && (
          <section className="mt-8 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
            <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-amber-400">
              <Clock className="h-4 w-4" /> Clientes Brabos a expirar
            </h3>
            <ul className="mt-3 space-y-1.5 text-sm">
              {expiringSoon.map(({ c, days }) => (
                <li key={c.id} className="flex items-center justify-between gap-3 rounded bg-amber-500/5 px-3 py-1.5">
                  <span className="font-semibold text-amber-100">{c.nome}</span>
                  <span className={`text-xs font-bold ${days <= 1 ? "text-orange-400" : "text-amber-300"}`}>
                    {days === 0 ? "expira hoje" : days === 1 ? "1 dia" : `${days} dias`}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {openWorkers.length > 0 && (
          <section className="mt-8 rounded-lg border-2 border-primary/40 bg-primary/5 p-4">
            <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-primary">
              <Clock className="h-4 w-4" /> Mecânicos em Serviço
            </h3>
            <ul className="mt-3 flex flex-wrap gap-2">
              {openWorkers.map((w) => (
                <li
                  key={w.id}
                  className="flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs"
                >
                  <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                  <span className="font-semibold text-primary">{fmtName(w.username, w.display_id)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {items.length > 0 && (
          <section className="mt-6 space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-primary">
              <Megaphone className="h-4 w-4" /> Comunicados
            </h3>
            {items.map((a) => (
              <div key={a.id} className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                <div className="font-bold text-primary">{a.title}</div>
                <div className="mt-1 whitespace-pre-wrap text-sm">{a.body}</div>
                <div className="mt-2 text-[11px] text-muted-foreground">
                  {new Date(a.created_at).toLocaleDateString("pt-BR", { timeZone: BRAZIL_TZ })}
                </div>
              </div>
            ))}
          </section>
        )}
      </Card>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Acesso rápido</h3>
          <Button
            variant={editingQuick ? "default" : "outline"}
            size="sm"
            onClick={() => setEditingQuick((v) => !v)}
            className="h-7 gap-1.5 text-xs"
          >
            {editingQuick ? (
              <>
                <CheckIcon className="h-3.5 w-3.5" /> Concluído
              </>
            ) : (
              <>
                <Pencil className="h-3.5 w-3.5" /> Personalizar
              </>
            )}
          </Button>
        </div>

        {editingQuick ? (
          <>
            <p className="mb-3 text-xs text-muted-foreground">Escolha quais atalhos aparecem no seu Acesso Rápido.</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {availableTabs.map((q) => {
                const checked = effectiveSelected.includes(q.id);
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => toggleQuick(q.id)}
                    className={`group relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 p-5 transition ${
                      checked
                        ? "border-primary bg-gradient-to-br from-primary/30 via-card to-card shadow-[0_0_25px_-8px_rgba(255,105,180,0.6)]"
                        : "border-muted/40 bg-card/40 opacity-60 hover:opacity-100"
                    }`}
                  >
                    <span
                      className={`absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full border ${checked ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40 bg-background"}`}
                    >
                      {checked ? <CheckIcon className="h-3 w-3" /> : null}
                    </span>
                    <q.icon className={`h-8 w-8 ${checked ? "text-primary" : "text-muted-foreground"}`} />
                    <span className="text-center text-sm font-semibold text-foreground">{q.label}</span>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {quickTabs.map((q) => (
              <button
                key={q.id}
                onClick={() => onChangeTab(q.id)}
                className="group flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-primary/40 bg-gradient-to-br from-primary/20 via-card to-card p-5 transition hover:border-primary hover:from-primary/40 hover:shadow-[0_0_30px_-5px_rgba(255,105,180,0.6)]"
              >
                <q.icon className="h-8 w-8 text-primary transition group-hover:scale-110" />
                <span className="text-center text-sm font-semibold text-foreground">{q.label}</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

// ---------- Ponto page ----------
interface PunchRow {
  id: string;
  entry_at: string;
  exit_at: string | null;
}

function PontoPage({ token }: { token: string }) {
  const [items, setItems] = useState<PunchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const list_ = useServerFn(listMyTimeclockFn);
  const punch_ = useServerFn(clockPunchFn);

  async function refresh() {
    const res = await list_({ data: { token } });
    setItems((res.items ?? []) as PunchRow[]);
    setLoading(false);
  }
  useEffect(() => {
    refresh(); /* eslint-disable-next-line */
  }, []);

  const open = items.find((r) => !r.exit_at);

  async function punch() {
    const res = await punch_({ data: { token } });
    toast.success(res.action === "in" ? "Entrada registada" : "Saída registada");
    refresh();
  }

  function fmt(d: string) {
    return fmtBRDateTime(d);
  }
  function duration(a: string, b: string | null) {
    const end = b ? new Date(b).getTime() : Date.now();
    const ms = end - new Date(a).getTime();
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    return `${h}h ${m}m`;
  }

  // Filter to current month (Brasília tz). Previous months are archived
  // (still visible to Admin in Relatórios).
  const ymFmt = useMemo(
    () => new Intl.DateTimeFormat("en-CA", { timeZone: BRAZIL_TZ, year: "numeric", month: "2-digit" }),
    [],
  );
  const currentYm = ymFmt.format(new Date());
  const monthItems = useMemo(
    () => items.filter((r) => ymFmt.format(new Date(r.entry_at)) === currentYm),
    [items, ymFmt, currentYm],
  );

  // Total hours in current month (Brasília timezone)
  const monthlyMs = useMemo(() => {
    let total = 0;
    for (const r of monthItems) {
      const end = r.exit_at ? new Date(r.exit_at).getTime() : Date.now();
      total += end - new Date(r.entry_at).getTime();
    }
    return total;
  }, [monthItems]);
  const monthName = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: BRAZIL_TZ });
  const monthH = Math.floor(monthlyMs / 3_600_000);
  const monthM = Math.floor((monthlyMs % 3_600_000) / 60_000);

  return (
    <PageShell title="Ponto">
      <Card className="mb-4 border-2 border-primary/60 bg-gradient-to-br from-primary/20 via-card to-card p-6 shadow-[var(--shadow-brand)]">
        <div className="flex flex-col items-center gap-1 text-center">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total no mês</span>
          <span className="text-sm capitalize text-primary">{monthName}</span>
          <span className="mt-1 text-5xl font-bold tabular-nums text-primary drop-shadow-[0_0_15px_rgba(255,105,180,0.5)] sm:text-6xl">
            {monthH}h {monthM.toString().padStart(2, "0")}m
          </span>
        </div>
      </Card>

      <Card className="border-primary/30 bg-card/60 p-6 text-center">
        <Clock className="mx-auto mb-3 h-10 w-10 text-primary" />
        <p className="mb-4 text-sm text-muted-foreground">
          {open ? `Entrada: ${fmt(open.entry_at)}` : "Sem entrada ativa"}
        </p>
        <Button
          onClick={punch}
          className={`min-w-48 ${open ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-[var(--shadow-brand)]"}`}
        >
          {open ? "Registar Saída" : "Registar Entrada"}
        </Button>
      </Card>

      <h3 className="mt-6 mb-2 text-sm font-bold uppercase tracking-wide text-primary">Histórico do mês atual</h3>
      <Card className="border-border/40 bg-card/40 p-2">
        {loading ? (
          <p className="p-4 text-center text-sm text-muted-foreground">Carregando…</p>
        ) : monthItems.length === 0 ? (
          <p className="p-4 text-center text-sm text-muted-foreground">Sem registos neste mês.</p>
        ) : (
          <ul className="divide-y divide-border/30">
            {monthItems.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <div>
                  <div className="font-medium">
                    Entrada: <span className="text-primary">{fmt(r.entry_at)}</span>
                  </div>
                  <div className="text-muted-foreground">Saída: {r.exit_at ? fmt(r.exit_at) : "—"}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-primary tabular-nums">{duration(r.entry_at, r.exit_at)}</div>
                  {!r.exit_at && <div className="text-[10px] uppercase text-muted-foreground">em curso</div>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </PageShell>
  );
}

// ---------- Perfis page ----------
function PerfisPage({
  token,
  users,
  currentUser,
  onUsersChanged,
}: {
  token: string;
  users: User[];
  currentUser: User;
  onUsersChanged: () => void;
}) {
  const approve_ = useServerFn(approveUserFn);
  const reject_ = useServerFn(rejectUserFn);
  const remove_ = useServerFn(removeUserFn);
  const update_ = useServerFn(updateUserFn);
  const reset_ = useServerFn(resetPasswordFn);

  const [editing, setEditing] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{
    username: string;
    role: Role;
    birthday: string;
    display_id: string;
  } | null>(null);
  const [resetting, setResetting] = useState<string | null>(null);
  const [newPwd, setNewPwd] = useState("");

  const pending = users.filter((u) => u.status === "pending");
  const approved = users.filter((u) => u.status === "approved");

  async function approve(u: User) {
    const res = await approve_({ data: { token, id: u.id } });
    if ("error" in res) return toast.error(String(res.error));
    toast.success(`${u.username} aprovado`);
    onUsersChanged();
  }
  async function reject(u: User) {
    const res = await reject_({ data: { token, id: u.id } });
    if ("error" in res) return toast.error(String(res.error));
    toast.success(`${u.username} rejeitado`);
    onUsersChanged();
  }
  async function removeUser(u: User) {
    const res = await remove_({ data: { token, id: u.id } });
    if ("error" in res) return toast.error(String(res.error));
    toast.success("Perfil apagado");
    onUsersChanged();
  }
  async function saveEdit() {
    if (!editDraft || !editing) return;
    const name = editDraft.username.trim();
    if (!name) return toast.error("Usuário obrigatório");
    const res = await update_({
      data: {
        token,
        id: editing,
        username: name,
        role: editDraft.role,
        birthday: editDraft.birthday || null,
        display_id: editDraft.display_id.trim() || null,
      },
    });
    if ("error" in res) return toast.error(String(res.error));
    setEditing(null);
    setEditDraft(null);
    toast.success("Perfil atualizado");
    onUsersChanged();
  }
  async function applyReset(id: string) {
    if (!newPwd) return toast.error("Defina a nova senha");
    const res = await reset_({ data: { token, id, password: newPwd } });
    if ("error" in res) return toast.error(String(res.error));
    setResetting(null);
    setNewPwd("");
    toast.success("Senha redefinida");
  }

  return (
    <PageShell title="Gestão de Perfis">
      <section className="space-y-3">
        <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-primary">
          <UserPlus className="h-4 w-4" /> Pedidos pendentes
          {pending.length > 0 && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] text-primary-foreground">
              {pending.length}
            </span>
          )}
        </h3>
        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem pedidos pendentes.</p>
        ) : (
          <div className="space-y-2">
            {pending.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between gap-2 rounded-md border border-primary/30 bg-primary/5 p-3"
              >
                <div className="min-w-0">
                  <div className="font-semibold">{fmtName(u.username, u.display_id)}</div>
                  <div className="text-xs text-muted-foreground">Aguarda aprovação</div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => approve(u)}
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <CheckIcon className="h-4 w-4" /> Aprovar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => reject(u)}
                    className="border-destructive/50 text-destructive hover:bg-destructive/10"
                  >
                    <XIcon className="h-4 w-4" /> Rejeitar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-6 space-y-3 border-t border-border/40 pt-5">
        <h3 className="text-sm font-bold uppercase tracking-wide text-primary">Perfis aprovados</h3>
        <div className="space-y-2">
          {approved.map((u) => (
            <div key={u.id} className="rounded-md border border-border/40 bg-background/40 p-3">
              {editing === u.id && editDraft ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Utilizador</Label>
                    <Input
                      value={editDraft.username}
                      onChange={(e) => setEditDraft({ ...editDraft, username: e.target.value })}
                      placeholder="Utilizador"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Função</Label>
                    <Select
                      value={editDraft.role}
                      onValueChange={(v) => setEditDraft({ ...editDraft, role: v as Role })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mecanico">Mecânico</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">ID</Label>
                    <Input
                      value={editDraft.display_id}
                      onChange={(e) => setEditDraft({ ...editDraft, display_id: e.target.value })}
                      maxLength={60}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Data de Aniversário</Label>
                    <Input
                      type="date"
                      value={editDraft.birthday}
                      onChange={(e) => setEditDraft({ ...editDraft, birthday: e.target.value })}
                    />
                  </div>
                  <div className="flex gap-2 sm:col-span-2">
                    <Button
                      size="sm"
                      onClick={saveEdit}
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      Guardar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditing(null);
                        setEditDraft(null);
                      }}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : resetting === u.id ? (
                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">
                      Nova senha para{" "}
                      <span className="font-semibold text-foreground">{fmtName(u.username, u.display_id)}</span>
                    </div>
                    <PasswordInput value={newPwd} onChange={setNewPwd} placeholder="Nova senha" />
                  </div>
                  <div className="flex items-end gap-2">
                    <Button
                      size="sm"
                      onClick={() => applyReset(u.id)}
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      Redefinir
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setResetting(null);
                        setNewPwd("");
                      }}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold">
                      {fmtName(u.username, u.display_id)}{" "}
                      {u.id === currentUser.id && <span className="text-xs text-muted-foreground">(tu)</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {u.role === "admin" ? "Admin" : "Mecânico"}
                      {u.birthday ? <> · 🎂 {fmtBRDate(u.birthday + "T12:00:00")}</> : null}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setResetting(u.id);
                        setNewPwd("");
                      }}
                      title="Redefinir senha"
                    >
                      <KeyRound className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setEditing(u.id);
                        setEditDraft({
                          username: u.username,
                          role: u.role,
                          birthday: u.birthday ?? "",
                          display_id: u.display_id ?? "",
                        });
                      }}
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeUser(u)}
                      title="Apagar"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </PageShell>
  );
}

// ---------- Config page (prices + logo + announcements) ----------
function ConfigPage({
  token,
  config,
  onConfigChanged,
}: {
  token: string;
  config: Config;
  onConfigChanged: (config: Config) => void;
}) {
  const [draft, setDraft] = useState<Config>(config);
  useEffect(() => {
    setDraft(config);
  }, [config]);
  const saveConfig_ = useServerFn(saveConfigFn);
  const createAnn_ = useServerFn(createAnnouncementFn);
  const delAnn_ = useServerFn(deleteAnnouncementFn);
  const list_ = useServerFn(listAnnouncementsFn);

  const [items, setItems] = useState<Announcement[]>([]);
  const [annTitle, setAnnTitle] = useState("");
  const [annBody, setAnnBody] = useState("");
  const [annExpires, setAnnExpires] = useState("");

  async function refreshAnn() {
    const res = await list_({ data: { token } });
    setItems((res.items ?? []) as Announcement[]);
  }
  useEffect(() => {
    refreshAnn(); /* eslint-disable-next-line */
  }, []);

  async function saveConfig() {
    try {
      const res = await saveConfig_({ data: { token, data: draft as unknown as Record<string, unknown> } });
      if ("error" in res) return toast.error(String(res.error));
      onConfigChanged(draft);
      toast.success("Configurações salvas!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar configurações");
    }
  }

  // Immediate cloud-persisted update (used by toggles and item add/remove).
  async function persist(next: Config, msg?: string) {
    setDraft(next);
    onConfigChanged(next);
    try {
      const res = await saveConfig_({ data: { token, data: next as unknown as Record<string, unknown> } });
      if ("error" in res) throw new Error(String(res.error));
      if (msg) toast.success(msg);
    } catch (err) {
      setDraft(config);
      onConfigChanged(config);
      toast.error(err instanceof Error ? err.message : "Erro ao salvar configuração");
    }
  }

  async function postAnn() {
    if (!annTitle.trim() || !annBody.trim()) return toast.error("Preencha título e mensagem");
    const res = await createAnn_({
      data: {
        token,
        title: annTitle,
        body: annBody,
        expires_at: annExpires ? new Date(annExpires).toISOString() : null,
      },
    });
    if ("error" in res) return toast.error(String(res.error));
    setAnnTitle("");
    setAnnBody("");
    setAnnExpires("");
    toast.success("Comunicado publicado");
    refreshAnn();
  }
  async function delAnn(id: string) {
    const res = await delAnn_({ data: { token, id } });
    if ("error" in res) return toast.error(String(res.error));
    toast.success("Comunicado removido");
    refreshAnn();
  }

  return (
    <PageShell title="Configurações">
      {/* Comunicados */}
      <section className="mt-6 space-y-3">
        <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-primary">
          <Megaphone className="h-4 w-4" /> Comunicados
        </h3>
        <Card className="space-y-3 border-primary/30 bg-card/60 p-4">
          <Input placeholder="Título" value={annTitle} onChange={(e) => setAnnTitle(e.target.value)} />
          <Textarea placeholder="Mensagem" value={annBody} onChange={(e) => setAnnBody(e.target.value)} rows={3} />
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="space-y-1">
              <Label className="text-xs">Validade (opcional)</Label>
              <Input type="datetime-local" value={annExpires} onChange={(e) => setAnnExpires(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button onClick={postAnn} className="bg-primary text-primary-foreground hover:bg-primary/90">
                Publicar
              </Button>
            </div>
          </div>
        </Card>
        {items.length > 0 && (
          <div className="space-y-2">
            {items.map((a) => (
              <div
                key={a.id}
                className="flex items-start justify-between gap-2 rounded-md border border-border/40 bg-background/40 p-3"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-primary">{a.title}</div>
                  <div className="whitespace-pre-wrap text-sm">{a.body}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {fmtBRDateTime(a.created_at)}
                    {a.expires_at && ` • expira ${fmtBRDateTime(a.expires_at)}`}
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => delAnn(a.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Visibilidade das abas (Mecânicos) */}
      <section className="mt-8 space-y-3">
        <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-primary">
          <Eye className="h-4 w-4" /> Visibilidade das Abas — Mecânicos
        </h3>
        <Card className="space-y-3 border-primary/30 bg-card/60 p-4">
          <p className="text-xs text-muted-foreground">
            Escolha quais abas os mecânicos podem ver. <span className="text-primary">Início</span> e{" "}
            <span className="text-primary">Calculadora</span> estão sempre visíveis.
          </p>
          {(
            [
              { key: "ponto", label: "Ponto" },
              { key: "clientes", label: "Clientes" },
              { key: "sugestoes", label: "Sugestões" },
              { key: "logs", label: "Change Logs" },
            ] as { key: keyof MecanicoTabsVisibility; label: string }[]
          ).map(({ key, label }) => {
            const mtv = resolveMecanicoTabs(draft);
            return (
              <label
                key={key}
                className="flex items-center justify-between gap-3 rounded-md border border-border/30 bg-background/40 px-3 py-2"
              >
                <span className="text-sm font-medium">{label}</span>
                <Checkbox
                  checked={mtv[key]}
                  onCheckedChange={(v) =>
                    persist({ ...draft, mecanicoTabs: { ...resolveMecanicoTabs(draft), [key]: v === true } })
                  }
                />
              </label>
            );
          })}
        </Card>
      </section>

      {/* Player de Música */}
      <section className="mt-8 space-y-3">
        <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-primary">
          <Music className="h-4 w-4" /> Player de Música
        </h3>
        <MusicTracksEditor
          token={token}
          tracks={resolveMusicTracks(draft)}
          onChange={(nextTracks, msg) => persist({ ...draft, musicTracks: nextTracks }, msg)}
        />
      </section>


      <section className="mt-8 space-y-3">
        <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-primary">
          <CalculatorIcon className="h-4 w-4" /> Itens Personalizados da Calculadora
        </h3>
        <p className="text-xs text-muted-foreground">
          Adicione novos itens em cada secção. Aparecem para todos na calculadora.
        </p>
        {(
          [
            { key: "produtos", label: "Produtos" },
            { key: "atendimentos", label: "Atendimentos" },
            { key: "pneuZona", label: "Pneu por Zona" },
          ] as { key: keyof CustomCalc; label: string }[]
        ).map(({ key, label }) => (
          <CustomItemsEditor
            key={key}
            label={label}
            items={resolveCustomCalc(draft)[key]}
            onAdd={(nome: string, valor: number) => {
              const cur = resolveCustomCalc(draft);
              const id =
                typeof crypto !== "undefined" && crypto.randomUUID
                  ? crypto.randomUUID()
                  : `${Date.now()}-${Math.random()}`;
              const next: Config = { ...draft, customCalc: { ...cur, [key]: [...cur[key], { id, nome, valor }] } };
              persist(next, "Item adicionado");
            }}
            onRemove={(id: string) => {
              const cur = resolveCustomCalc(draft);
              const next: Config = { ...draft, customCalc: { ...cur, [key]: cur[key].filter((x) => x.id !== id) } };
              persist(next, "Item removido");
            }}
          />
        ))}
      </section>

      {/* Preços */}
      <section className="mt-8 space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wide text-primary">Percentagens</h3>
        <div className="grid grid-cols-2 gap-3">
          <NumField
            label="Margem Tunagem (%)"
            value={draft.margemTunagem}
            onChange={(v) => setDraft({ ...draft, margemTunagem: v })}
          />
          <NumField
            label="Desconto Parceria (%)"
            value={draft.descontoParceria}
            onChange={(v) => setDraft({ ...draft, descontoParceria: v })}
          />
        </div>

        <h3 className="pt-2 text-sm font-bold uppercase tracking-wide text-primary">Conserto</h3>
        <div className="grid grid-cols-3 gap-3">
          <NumField
            label="MEC"
            value={draft.conserto.mec}
            onChange={(v) => setDraft({ ...draft, conserto: { ...draft.conserto, mec: v } })}
          />
          <NumField
            label="SUL"
            value={draft.conserto.sul}
            onChange={(v) => setDraft({ ...draft, conserto: { ...draft.conserto, sul: v } })}
          />
          <NumField
            label="NORTE"
            value={draft.conserto.norte}
            onChange={(v) => setDraft({ ...draft, conserto: { ...draft.conserto, norte: v } })}
          />
        </div>

        <h3 className="pt-2 text-sm font-bold uppercase tracking-wide text-primary">Reboque</h3>
        <div className="grid grid-cols-3 gap-3">
          <NumField
            label="SUL"
            value={draft.reboque.sul}
            onChange={(v) => setDraft({ ...draft, reboque: { ...draft.reboque, sul: v } })}
          />
          <NumField
            label="NORTE"
            value={draft.reboque.norte}
            onChange={(v) => setDraft({ ...draft, reboque: { ...draft.reboque, norte: v } })}
          />
          <NumField
            label="Carro Explodido"
            value={draft.reboque.explodido}
            onChange={(v) => setDraft({ ...draft, reboque: { ...draft.reboque, explodido: v } })}
          />
        </div>

        <h3 className="pt-2 text-sm font-bold uppercase tracking-wide text-primary">Adicional Kits</h3>
        <div className="grid grid-cols-2 gap-3">
          <NumField
            label="SUL"
            value={draft.adicionalKits.sul}
            onChange={(v) => setDraft({ ...draft, adicionalKits: { ...draft.adicionalKits, sul: v } })}
          />
          <NumField
            label="NORTE"
            value={draft.adicionalKits.norte}
            onChange={(v) => setDraft({ ...draft, adicionalKits: { ...draft.adicionalKits, norte: v } })}
          />
        </div>

        <h3 className="pt-2 text-sm font-bold uppercase tracking-wide text-primary">Produtos</h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <NumField
            label="Chave Inglesa"
            value={draft.produtos.chaveInglesa}
            onChange={(v) => setDraft({ ...draft, produtos: { ...draft.produtos, chaveInglesa: v } })}
          />
          <NumField
            label="Kit Básico"
            value={draft.produtos.kitBasico}
            onChange={(v) => setDraft({ ...draft, produtos: { ...draft.produtos, kitBasico: v } })}
          />
          <NumField
            label="Kit Avançado"
            value={draft.produtos.kitAvancado}
            onChange={(v) => setDraft({ ...draft, produtos: { ...draft.produtos, kitAvancado: v } })}
          />
          <NumField
            label="Pneu"
            value={draft.produtos.pneu}
            onChange={(v) => setDraft({ ...draft, produtos: { ...draft.produtos, pneu: v } })}
          />
          <NumField
            label="Ursinho"
            value={draft.produtos.ursinho}
            onChange={(v) => setDraft({ ...draft, produtos: { ...draft.produtos, ursinho: v } })}
          />
          <NumField
            label="Pneu por Zona"
            value={draft.pneuZona}
            onChange={(v) => setDraft({ ...draft, pneuZona: v })}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => setDraft({ ...DEFAULT_CONFIG, logoUrl: draft.logoUrl })}>
            Restaurar padrão
          </Button>
          <Button
            onClick={saveConfig}
            className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-[var(--shadow-brand)]"
          >
            Salvar configurações
          </Button>
        </div>
      </section>
    </PageShell>
  );
}

// ---------- Relatórios (horas trabalhadas) ----------
interface PunchAdminRow {
  id: string;
  user_id: string;
  entry_at: string;
  exit_at: string | null;
  username: string;
  display_id: string | null;
}

function RelatoriosPage({ token }: { token: string }) {
  const [items, setItems] = useState<PunchAdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const list_ = useServerFn(listAllTimeclockFn);

  useEffect(() => {
    (async () => {
      const res = await list_({ data: { token } });
      setItems((res.items ?? []) as PunchAdminRow[]);
      setLoading(false);
    })();
    // eslint-disable-next-line
  }, []);

  function hhmm(ms: number) {
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    return `${h}h ${m}m`;
  }
  function fmt(d: string) {
    return fmtBRDateTime(d);
  }

  const ymFmt = useMemo(
    () => new Intl.DateTimeFormat("en-CA", { timeZone: BRAZIL_TZ, year: "numeric", month: "2-digit" }),
    [],
  );
  const monthLabel = useMemo(
    () => new Intl.DateTimeFormat("pt-BR", { timeZone: BRAZIL_TZ, month: "long", year: "numeric" }),
    [],
  );

  // Per-user, per-month aggregation
  type UserMonth = { ym: string; label: string; ms: number; count: number; rows: PunchAdminRow[] };
  type UserAgg = { user_id: string; username: string; display_id: string | null; months: UserMonth[]; totalMs: number };
  const byUser = useMemo(() => {
    const map = new Map<string, UserAgg>();
    for (const r of items) {
      if (!r.exit_at) continue;
      const ms = new Date(r.exit_at).getTime() - new Date(r.entry_at).getTime();
      const ym = ymFmt.format(new Date(r.entry_at));
      const ua = map.get(r.user_id) ?? {
        user_id: r.user_id,
        username: r.username,
        display_id: r.display_id,
        months: [],
        totalMs: 0,
      };
      let m = ua.months.find((x) => x.ym === ym);
      if (!m) {
        m = { ym, label: monthLabel.format(new Date(r.entry_at)), ms: 0, count: 0, rows: [] };
        ua.months.push(m);
      }
      m.ms += ms;
      m.count += 1;
      m.rows.push(r);
      ua.totalMs += ms;
      map.set(r.user_id, ua);
    }
    const arr = Array.from(map.values());
    for (const u of arr) u.months.sort((a, b) => (a.ym < b.ym ? 1 : -1));
    arr.sort((a, b) => b.totalMs - a.totalMs);
    return arr;
  }, [items, ymFmt, monthLabel]);

  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);

  return (
    <PageShell title="Relatórios — Horas Trabalhadas">
      <section className="space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-wide text-primary">Por mecânico e mês</h3>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : byUser.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem registos.</p>
        ) : (
          <div className="space-y-2">
            {byUser.map((u) => {
              const isOpen = expandedUser === u.user_id;
              return (
                <Card key={u.user_id} className="border-primary/30 bg-card/60 p-0">
                  <button
                    onClick={() => setExpandedUser(isOpen ? null : u.user_id)}
                    className="flex w-full items-center justify-between gap-2 p-4 text-left hover:bg-primary/5"
                  >
                    <div>
                      <div className="font-semibold">{fmtName(u.username, u.display_id)}</div>
                      <div className="text-xs text-muted-foreground">{u.months.length} mês(es)</div>
                    </div>
                    <div className="text-lg font-bold tabular-nums text-primary">{hhmm(u.totalMs)}</div>
                  </button>
                  {isOpen && (
                    <div className="border-t border-border/40 p-3 space-y-2">
                      {u.months.map((m) => {
                        const mKey = `${u.user_id}:${m.ym}`;
                        const mOpen = expandedMonth === mKey;
                        return (
                          <div key={m.ym} className="rounded-md border border-border/40 bg-background/40">
                            <button
                              onClick={() => setExpandedMonth(mOpen ? null : mKey)}
                              className="flex w-full items-center justify-between gap-2 p-3 text-left text-sm hover:bg-primary/5"
                            >
                              <div className="capitalize">
                                <span className="font-semibold">{m.label}</span> · {m.count} registos
                              </div>
                              <div className="font-bold tabular-nums text-primary">{hhmm(m.ms)}</div>
                            </button>
                            {mOpen && (
                              <ul className="divide-y divide-border/30 border-t border-border/40">
                                {m.rows.map((r) => (
                                  <li
                                    key={r.id}
                                    className="flex flex-wrap items-center justify-between gap-2 p-3 text-xs"
                                  >
                                    <span>
                                      {fmt(r.entry_at)} → {r.exit_at ? fmt(r.exit_at) : "em curso"}
                                    </span>
                                    <span className="font-bold tabular-nums">
                                      {r.exit_at
                                        ? hhmm(new Date(r.exit_at).getTime() - new Date(r.entry_at).getTime())
                                        : "—"}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </PageShell>
  );
}

function MusicTracksEditor({
  token,
  tracks,
  onChange,
}: {
  token: string;
  tracks: MusicTrack[];
  onChange: (next: MusicTrack[], msg?: string) => void;
}) {
  const upload_ = useServerFn(uploadMusicTrackFn);
  const [nome, setNome] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function handleUpload() {
    if (!nome.trim()) return toast.error("Indique o nome da faixa");
    if (!file) return toast.error("Selecione um ficheiro de áudio");
    if (file.size > 20 * 1024 * 1024) return toast.error("Ficheiro muito grande (máx. 20 MB)");
    setUploading(true);
    try {
      const buf = await file.arrayBuffer();
      // Convert to base64 in chunks to avoid stack overflow on large files.
      const bytes = new Uint8Array(buf);
      let bin = "";
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }
      const base64 = btoa(bin);
      const res = await upload_({
        data: { token, filename: file.name, contentType: file.type || "audio/mpeg", base64 },
      });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      const id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`;
      onChange([...tracks, { id, nome: nome.trim(), url: res.url }], "Faixa adicionada");
      setNome("");
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro no upload");
    } finally {
      setUploading(false);
    }
  }

  function removeTrack(id: string) {
    onChange(tracks.filter((t) => t.id !== id), "Faixa removida");
  }

  return (
    <Card className="space-y-3 border-primary/30 bg-card/60 p-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="space-y-2">
          <div>
            <Label className="text-xs">Nome da faixa</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Intro Mecânica" />
          </div>
          <div>
            <Label className="text-xs">Ficheiro de áudio</Label>
            <Input
              ref={inputRef}
              type="file"
              accept="audio/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>
        <div className="flex items-end">
          <Button
            onClick={handleUpload}
            disabled={uploading}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Upload className="mr-1 h-4 w-4" /> {uploading ? "A enviar..." : "Adicionar"}
          </Button>
        </div>
      </div>

      {tracks.length > 0 && (
        <ul className="space-y-2">
          {tracks.map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between gap-2 rounded-md border border-border/40 bg-background/40 px-3 py-2 text-sm"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Music className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate">{t.nome}</span>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => removeTrack(t.id)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type="number" min={0} value={value} onChange={(e) => onChange(Number(e.target.value) || 0)} />
    </div>
  );
}

// ---------- Clientes ----------
type Cliente = {
  id: string;
  nome: string;
  id_passaporte: string;
  celular: string | null;
  cliente_brabo: boolean;
  cliente_brabo_expira: string | null;
  criado_por: string;
  created_at: string;
  criado_por_username: string;
  criado_por_display_id: string | null;
};

function ClientesPage({ token, isAdmin }: { token: string; isAdmin: boolean }) {
  const list_ = useServerFn(listClientesFn);
  const create_ = useServerFn(createClienteFn);
  const update_ = useServerFn(updateClienteFn);
  const delete_ = useServerFn(deleteClienteFn);
  const renew_ = useServerFn(renewClienteBraboFn);

  const [items, setItems] = useState<Cliente[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  const [nome, setNome] = useState("");
  const [idPass, setIdPass] = useState("");
  const [celular, setCelular] = useState("");
  const [brabo, setBrabo] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editing, setEditing] = useState<Cliente | null>(null);

  async function refresh(query = q) {
    setLoading(true);
    try {
      const res = await list_({ data: { token, q: query || undefined } });
      setItems((res.items ?? []) as Cliente[]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(() => refresh(q), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim() || !idPass.trim()) {
      toast.error("Preencha Nome e ID / Passaporte");
      return;
    }
    setSaving(true);
    try {
      const res = await create_({
        data: {
          token,
          nome: nome.trim(),
          id_passaporte: idPass.trim(),
          celular: celular.trim() || null,
          cliente_brabo: brabo,
        },
      });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Cliente registrado");
      setNome("");
      setIdPass("");
      setCelular("");
      setBrabo(false);
      refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(c: Cliente) {
    if (!confirm(`Apagar cliente "${c.nome}"?`)) return;
    await delete_({ data: { token, id: c.id } });
    toast.success("Cliente apagado");
    refresh();
  }

  async function handleSaveEdit() {
    if (!editing) return;
    if (!editing.nome.trim() || !editing.id_passaporte.trim()) {
      toast.error("Preencha Nome e ID / Passaporte");
      return;
    }
    const res = await update_({
      data: {
        token,
        id: editing.id,
        nome: editing.nome.trim(),
        id_passaporte: editing.id_passaporte.trim(),
        celular: (editing.celular ?? "").trim() || null,
        cliente_brabo: editing.cliente_brabo,
        cliente_brabo_expira: editing.cliente_brabo ? editing.cliente_brabo_expira : null,
      },
    });
    if ("error" in res) {
      toast.error(res.error);
      return;
    }
    toast.success("Cliente atualizado");
    setEditing(null);
    refresh();
  }

  return (
    <PageShell title="Clientes">
      <Card className="p-4">
        <h2 className="mb-3 text-lg font-semibold">Registrar novo cliente</h2>
        <form onSubmit={handleCreate} className="grid gap-3 md:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto_auto]">
          <div>
            <Label htmlFor="cli-nome" className="text-xs">
              Nome
            </Label>
            <Input id="cli-nome" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} />
          </div>
          <div>
            <Label htmlFor="cli-id" className="text-xs">
              ID / Passaporte
            </Label>
            <Input id="cli-id" value={idPass} onChange={(e) => setIdPass(e.target.value)} maxLength={60} />
          </div>
          <div>
            <Label htmlFor="cli-cel" className="text-xs">
              Número de Celular
            </Label>
            <Input
              id="cli-cel"
              value={celular}
              onChange={(e) => setCelular(e.target.value)}
              placeholder="(055) 541-712"
              maxLength={40}
            />
          </div>
          <label className="flex items-end gap-2 pb-2">
            <Checkbox id="cli-brabo" checked={brabo} onCheckedChange={(v) => setBrabo(v === true)} />
            <span className="text-sm">Cliente Brabo</span>
          </label>
          <Button type="submit" disabled={saving} className="self-end">
            <UserPlus className="mr-1 h-4 w-4" />
            {saving ? "Salvando..." : "Registrar"}
          </Button>
        </form>
      </Card>

      <Card className="mt-4 p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Clientes registrados</h2>
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por nome ou ID..."
              className="pl-8"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="py-6 text-center text-sm text-muted-foreground">Carregando...</div>
        ) : items.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">Nenhum cliente encontrado.</div>
        ) : (
          <div className="space-y-2">
            {items.map((c) => (
              <div
                key={c.id}
                className="flex flex-col gap-2 rounded-md border border-border bg-card/50 p-3 md:flex-row md:items-center md:justify-between"
              >
                {editing?.id === c.id ? (
                  <div className="grid w-full gap-2 md:grid-cols-[1fr_1fr_1fr_auto]">
                    <Input
                      value={editing.nome}
                      onChange={(e) => setEditing({ ...editing, nome: e.target.value })}
                      maxLength={120}
                    />
                    <Input
                      value={editing.id_passaporte}
                      onChange={(e) => setEditing({ ...editing, id_passaporte: e.target.value })}
                      maxLength={60}
                    />
                    <Input
                      value={editing.celular ?? ""}
                      onChange={(e) => setEditing({ ...editing, celular: e.target.value })}
                      placeholder="(055) 541-712"
                      maxLength={40}
                    />
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={editing.cliente_brabo}
                        onCheckedChange={(v) => setEditing({ ...editing, cliente_brabo: v === true })}
                      />
                      Brabo
                    </label>
                  </div>
                ) : (
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{c.nome}</span>
                      {(() => {
                        const exp = c.cliente_brabo_expira ? new Date(c.cliente_brabo_expira).getTime() : 0;
                        const now = Date.now();
                        const dayMs = 24 * 60 * 60 * 1000;
                        if (c.cliente_brabo && exp > now) {
                          const daysLeft = Math.ceil((exp - now) / dayMs);
                          const soon = daysLeft <= 5;
                          return (
                            <span
                              className={
                                "rounded-full px-2 py-0.5 text-xs font-medium " +
                                (soon
                                  ? "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                                  : "bg-primary/20 text-primary")
                              }
                              title={`Expira em ${fmtBRDate(c.cliente_brabo_expira!)}`}
                            >
                              Cliente Brabo · {daysLeft}d
                            </span>
                          );
                        }
                        if (c.cliente_brabo_expira && exp <= now) {
                          return (
                            <span className="rounded-full bg-destructive/20 px-2 py-0.5 text-xs font-medium text-destructive">
                              Cliente Brabo expirado
                            </span>
                          );
                        }
                        return null;
                      })()}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      ID: <span className="font-mono">{c.id_passaporte}</span>
                      {c.celular ? (
                        <>
                          {" "}
                          · Cel: <span className="font-mono">{c.celular}</span>
                        </>
                      ) : null}{" "}
                      · por {fmtName(c.criado_por_username, c.criado_por_display_id)} · em {fmtBRDateTime(c.created_at)}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 md:justify-end">
                  {editing?.id === c.id ? (
                    isAdmin ? (
                      <>
                        <Button size="sm" onClick={handleSaveEdit}>
                          <CheckIcon className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                          <XIcon className="h-4 w-4" />
                        </Button>
                      </>
                    ) : null
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          await renew_({ data: { token, id: c.id } });
                          toast.success("Cliente Brabo renovado por 30 dias");
                          refresh();
                        }}
                        title="Renovar Cliente Brabo (+30 dias)"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                      {isAdmin && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => setEditing(c)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleDelete(c)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </PageShell>
  );
}
// ---------- Theme toggle (sidebar menu item) ----------
function BirthdayBalloons() {
  // Generate a stable set of balloons (rendered once per mount).
  // Use negative delays so the screen is already covered at t=0,
  // and a single iteration of ~5s so they disappear together.
  const TOTAL_MS = 5000;
  const balloons = useMemo(() => {
    return Array.from({ length: 60 }, (_, i) => {
      const left = Math.random() * 100;
      const driftStart = (Math.random() - 0.5) * 80; // px
      const driftEnd = (Math.random() - 0.5) * 220;
      const duration = 5; // seconds, matches TOTAL_MS
      // Negative delay distributed across the animation so balloons appear
      // at random stages of their rise, filling the full viewport instantly.
      const delay = -Math.random() * duration;
      const size = 28 + Math.random() * 36;
      return { i, left, driftStart, driftEnd, duration, delay, size };
    });
  }, []);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setVisible(false), TOTAL_MS);
    return () => clearTimeout(t);
  }, []);
  if (!visible) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden">
      {balloons.map((b) => (
        <div
          key={b.i}
          className="mb-balloon"
          style={
            {
              left: `${b.left}%`,
              width: `${b.size}px`,
              height: `${b.size * 1.28}px`,
              animationDuration: `${b.duration}s`,
              animationDelay: `${b.delay}s`,
              animationIterationCount: 1,
              ["--mb-drift-start" as string]: `${b.driftStart}px`,
              ["--mb-drift-end" as string]: `${b.driftEnd}px`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

function ThemeToggleMenuItem() {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";
  return (
    <button
      onClick={toggle}
      aria-label={isDark ? "Mudar para modo diurno" : "Mudar para modo noturno"}
      className="flex items-center gap-3 rounded-md px-3 py-3 text-left text-sm font-medium text-foreground hover:bg-primary/10 hover:text-primary"
    >
      {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      {isDark ? "Modo diurno" : "Modo noturno"}
    </button>
  );
}

// ---------- Sugestões ----------
type Sugestao = {
  id: string;
  user_id: string;
  username: string;
  display_id: string | null;
  mensagem: string;
  status: "nova" | "vista" | "em_analise" | "concluida";
  created_at: string;
};

const STATUS_META: Record<Sugestao["status"], { label: string; cls: string }> = {
  nova: { label: "Nova", cls: "bg-primary/20 text-primary" },
  vista: { label: "Vista", cls: "bg-muted text-muted-foreground" },
  em_analise: { label: "Em análise", cls: "bg-amber-500/20 text-amber-500" },
  concluida: { label: "Concluída", cls: "bg-emerald-500/20 text-emerald-500" },
};

function SugestoesPage({ token, isAdmin }: { token: string; isAdmin: boolean }) {
  const list_ = useServerFn(listSugestoesFn);
  const create_ = useServerFn(createSugestaoFn);
  const updateStatus_ = useServerFn(updateSugestaoStatusFn);
  const delete_ = useServerFn(deleteSugestaoFn);

  const [items, setItems] = useState<Sugestao[]>([]);
  const [loading, setLoading] = useState(true);
  const [mensagem, setMensagem] = useState("");
  const [sending, setSending] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const res = await list_({ data: { token } });
      setItems((res.items ?? []) as Sugestao[]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh(); /* eslint-disable-next-line */
  }, []);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const m = mensagem.trim();
    if (!m) {
      toast.error("Escreva uma sugestão");
      return;
    }
    setSending(true);
    try {
      const res = await create_({ data: { token, mensagem: m } });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Sugestão enviada");
      setMensagem("");
      refresh();
    } finally {
      setSending(false);
    }
  }

  async function setStatus(s: Sugestao, status: Sugestao["status"]) {
    await updateStatus_({ data: { token, id: s.id, status } });
    toast.success("Status atualizado");
    refresh();
  }

  async function handleDelete(s: Sugestao) {
    if (!confirm("Apagar esta sugestão?")) return;
    const res = await delete_({ data: { token, id: s.id } });
    if (res && "error" in res) {
      toast.error(res.error);
      return;
    }
    toast.success("Sugestão apagada");
    refresh();
  }

  return (
    <PageShell title="Sugestões">
      <Card className="p-4">
        <h2 className="mb-2 text-lg font-semibold">Enviar sugestão</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Tem uma ideia para melhorar a Mecânica Braba? Conta-nos aqui.
        </p>
        <form onSubmit={handleSend} className="space-y-3">
          <Textarea
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            maxLength={2000}
            rows={4}
            placeholder="Descreve a tua sugestão..."
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">{mensagem.length}/2000</span>
            <Button type="submit" disabled={sending} className="shadow-[var(--shadow-brand-soft)]">
              <Send className="mr-1 h-4 w-4" />
              {sending ? "A enviar..." : "Enviar"}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="mt-4 p-4">
        <h2 className="mb-3 text-lg font-semibold">{isAdmin ? "Todas as sugestões" : "As minhas sugestões"}</h2>
        {loading ? (
          <div className="py-6 text-center text-sm text-muted-foreground">Carregando...</div>
        ) : items.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">Nenhuma sugestão ainda.</div>
        ) : (
          <ul className="space-y-2">
            {items.map((s) => {
              const meta = STATUS_META[s.status] ?? STATUS_META.nova;
              return (
                <li key={s.id} className="rounded-md border border-border bg-card/50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-semibold text-primary">{fmtName(s.username, s.display_id)}</span>
                      <span className="text-muted-foreground">· {fmtBRDateTime(s.created_at)}</span>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${meta.cls}`}>{meta.label}</span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm">{s.mensagem}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {isAdmin && (
                      <>
                        {(["vista", "em_analise", "concluida"] as const).map((st) => (
                          <Button
                            key={st}
                            size="sm"
                            variant={s.status === st ? "default" : "outline"}
                            onClick={() => setStatus(s, st)}
                          >
                            {STATUS_META[st].label}
                          </Button>
                        ))}
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="destructive"
                      className="ml-auto"
                      onClick={() => handleDelete(s)}
                      title="Apagar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </PageShell>
  );
}

// ---------- Custom calculator items editor (Config page) ----------
function CustomItemsEditor({
  label,
  items,
  onAdd,
  onRemove,
}: {
  label: string;
  items: CustomCalcItem[];
  onAdd: (nome: string, valor: number) => void;
  onRemove: (id: string) => void;
}) {
  const [nome, setNome] = useState("");
  const [valor, setValor] = useState("");
  function submit() {
    const n = nome.trim();
    const v = Number(valor) || 0;
    if (!n) {
      toast.error("Nome obrigatório");
      return;
    }
    if (v <= 0) {
      toast.error("Valor inválido");
      return;
    }
    onAdd(n, v);
    setNome("");
    setValor("");
  }
  return (
    <Card className="space-y-3 border-primary/30 bg-card/60 p-4">
      <div className="text-sm font-semibold text-primary">{label}</div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhum item personalizado.</p>
      ) : (
        <ul className="space-y-1">
          {items.map((it) => (
            <li
              key={it.id}
              className="flex items-center justify-between gap-2 rounded-md border border-border/40 bg-background/40 px-3 py-2 text-sm"
            >
              <span>
                <span className="font-medium">{it.nome}</span>{" "}
                <span className="text-muted-foreground">— {brl(it.valor)}</span>
              </span>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => onRemove(it.id)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="grid gap-2 sm:grid-cols-[1fr_140px_auto]">
        <Input placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} />
        <Input type="number" min={0} placeholder="Valor" value={valor} onChange={(e) => setValor(e.target.value)} />
        <Button onClick={submit} className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Adicionar
        </Button>
      </div>
    </Card>
  );
}

// ---------- Change Logs ----------
type Changelog = { id: string; titulo: string; descricao: string; data: string; created_at: string };

function ChangeLogsPage({ token, isAdmin }: { token: string; isAdmin: boolean }) {
  const list_ = useServerFn(listChangelogsFn);
  const create_ = useServerFn(createChangelogFn);
  const delete_ = useServerFn(deleteChangelogFn);

  const [items, setItems] = useState<Changelog[]>([]);
  const [loading, setLoading] = useState(true);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const todayBR = useMemo(
    () =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone: BRAZIL_TZ,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date()),
    [],
  );
  const [data, setData] = useState(todayBR);
  const [saving, setSaving] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const res = await list_({ data: { token } });
      setItems((res.items ?? []) as Changelog[]);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    refresh(); /* eslint-disable-next-line */
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim() || !descricao.trim() || !data) {
      toast.error("Preencha todos os campos");
      return;
    }
    setSaving(true);
    try {
      const res = await create_({ data: { token, titulo: titulo.trim(), descricao: descricao.trim(), data } });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Entrada criada");
      setTitulo("");
      setDescricao("");
      setData(todayBR);
      refresh();
    } finally {
      setSaving(false);
    }
  }
  async function handleDelete(c: Changelog) {
    if (!confirm("Apagar esta entrada?")) return;
    await delete_({ data: { token, id: c.id } });
    toast.success("Entrada apagada");
    refresh();
  }

  return (
    <PageShell title="Change Logs">
      {isAdmin && (
        <Card className="mb-4 p-4">
          <h2 className="mb-3 text-lg font-semibold">Nova entrada</h2>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
              <div>
                <Label className="text-xs">Título</Label>
                <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={200} />
              </div>
              <div>
                <Label className="text-xs">Data</Label>
                <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Descrição</Label>
              <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={4} maxLength={4000} />
            </div>
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={saving}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="mr-1 h-4 w-4" /> {saving ? "A guardar..." : "Publicar"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="p-4">
        <h2 className="mb-3 text-lg font-semibold">Histórico de alterações</h2>
        {loading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Carregando...</p>
        ) : items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma entrada ainda.</p>
        ) : (
          <ul className="space-y-3">
            {items.map((c) => (
              <li key={c.id} className="rounded-md border border-border bg-card/50 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-primary">{c.titulo}</div>
                    <div className="text-xs text-muted-foreground">{fmtBRDate(c.data + "T12:00:00")}</div>
                  </div>
                  {isAdmin && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(c)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm">{c.descricao}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </PageShell>
  );
}

// ---------- Cliente edit logs (admin) ----------
type ClienteLog = {
  id: string;
  cliente_id: string;
  cliente_nome: string;
  editor_id: string;
  editor_username: string;
  field: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
};

function ClienteLogsPage({ token }: { token: string }) {
  const list_ = useServerFn(listClienteLogsFn);
  const [items, setItems] = useState<ClienteLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await list_({ data: { token } });
        setItems((res.items ?? []) as ClienteLog[]);
      } finally {
        setLoading(false);
      }
    })();
    /* eslint-disable-next-line */
  }, []);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (l) =>
        l.cliente_nome.toLowerCase().includes(q) ||
        l.editor_username.toLowerCase().includes(q) ||
        l.field.toLowerCase().includes(q),
    );
  }, [items, filter]);

  return (
    <PageShell title="Logs de Clientes">
      <Card className="mb-4 p-4">
        <Label className="text-xs">Filtrar</Label>
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Cliente, editor ou campo"
        />
      </Card>
      <Card className="p-4">
        {loading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Carregando...</p>
        ) : filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Sem alterações registadas.</p>
        ) : (
          <ul className="space-y-2">
            {filtered.map((l) => (
              <li key={l.id} className="rounded-md border border-border bg-card/50 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold text-primary">{l.cliente_nome}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(l.created_at).toLocaleString("pt-BR", { timeZone: BRAZIL_TZ })}
                  </div>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Editor: <span className="text-foreground">{l.editor_username}</span> · Campo:{" "}
                  <span className="text-foreground">{l.field}</span>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <div className="rounded bg-muted/40 p-2">
                    <div className="text-[10px] uppercase text-muted-foreground">Antes</div>
                    <div className="whitespace-pre-wrap break-words">{l.old_value ?? "—"}</div>
                  </div>
                  <div className="rounded bg-muted/40 p-2">
                    <div className="text-[10px] uppercase text-muted-foreground">Depois</div>
                    <div className="whitespace-pre-wrap break-words">{l.new_value ?? "—"}</div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </PageShell>
  );
}

// ---------- Persistent Music Player ----------
function MusicPlayer({ tracks }: { tracks: MusicTrack[] }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);

  // Always start paused regardless of any previous state.
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.pause();
    setPlaying(false);
    /* eslint-disable-next-line */
  }, []);

  // Apply volume / mute changes.
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.volume = volume;
    a.muted = muted;
  }, [volume, muted]);

  // Clamp index if tracks change.
  useEffect(() => {
    if (index >= tracks.length) setIndex(0);
  }, [tracks.length, index]);

  const current = tracks[index];

  async function togglePlay() {
    const a = audioRef.current;
    if (!a || !current) return;
    if (playing) {
      a.pause();
      setPlaying(false);
      return;
    }
    try {
      // play() must be triggered from a user gesture (this click qualifies).
      await a.play();
      setPlaying(true);
    } catch (err) {
      toast.error("Não foi possível reproduzir o áudio");
      // eslint-disable-next-line no-console
      console.error("audio.play() failed:", err);
      setPlaying(false);
    }
  }

  function next() {
    if (tracks.length === 0) return;
    setIndex((i) => (i + 1) % tracks.length);
    setProgress(0);
    // continue playing if it was playing
    requestAnimationFrame(() => {
      if (playing) audioRef.current?.play().catch(() => setPlaying(false));
    });
  }
  function prev() {
    if (tracks.length === 0) return;
    setIndex((i) => (i - 1 + tracks.length) % tracks.length);
    setProgress(0);
    requestAnimationFrame(() => {
      if (playing) audioRef.current?.play().catch(() => setPlaying(false));
    });
  }

  function onTimeUpdate() {
    const a = audioRef.current;
    if (!a) return;
    setProgress(a.currentTime);
  }
  function onLoadedMeta() {
    const a = audioRef.current;
    if (!a) return;
    setDuration(isFinite(a.duration) ? a.duration : 0);
  }
  function onEnded() {
    next();
  }
  function seek(v: number) {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = v;
    setProgress(v);
  }

  function fmtTime(s: number) {
    if (!isFinite(s) || s <= 0) return "0:00";
    const m = Math.floor(s / 60);
    const r = Math.floor(s % 60);
    return `${m}:${r.toString().padStart(2, "0")}`;
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-primary/40 bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-3 py-2 sm:gap-4 sm:px-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Music className="h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">
              {current ? current.nome : "Sem faixas configuradas"}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {tracks.length > 0 ? `${index + 1} / ${tracks.length}` : "Adicione faixas em Configurações"}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={prev} disabled={tracks.length < 2} aria-label="Anterior">
            <SkipBack className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            onClick={togglePlay}
            disabled={!current}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            aria-label={playing ? "Pausar" : "Tocar"}
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <Button size="icon" variant="ghost" onClick={next} disabled={tracks.length < 2} aria-label="Próxima">
            <SkipForward className="h-4 w-4" />
          </Button>
        </div>

        <div className="order-last flex w-full items-center gap-2 sm:order-none sm:w-72">
          <span className="w-9 text-right text-[10px] tabular-nums text-muted-foreground">{fmtTime(progress)}</span>
          <Slider
            value={[progress]}
            min={0}
            max={duration || 1}
            step={0.1}
            onValueChange={(v) => seek(v[0] ?? 0)}
            disabled={!current}
            className="flex-1"
          />
          <span className="w-9 text-[10px] tabular-nums text-muted-foreground">{fmtTime(duration)}</span>
        </div>

        <div className="hidden items-center gap-2 sm:flex sm:w-32">
          <Button size="icon" variant="ghost" onClick={() => setMuted((m) => !m)} aria-label="Volume">
            {muted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>
          <Slider
            value={[muted ? 0 : volume]}
            min={0}
            max={1}
            step={0.01}
            onValueChange={(v) => {
              setVolume(v[0] ?? 0);
              if ((v[0] ?? 0) > 0) setMuted(false);
            }}
            className="flex-1"
          />
        </div>
      </div>

      {current && (
        <audio
          ref={audioRef}
          src={current.url}
          preload="metadata"
          onTimeUpdate={onTimeUpdate}
          onLoadedMetadata={onLoadedMeta}
          onEnded={onEnded}
          onPause={() => setPlaying(false)}
          onPlay={() => setPlaying(true)}
        />
      )}
    </div>
  );
}

