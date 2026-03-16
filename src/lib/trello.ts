// ── Trello REST API v1 client ────────────────────────────────
// Credentials are stored in .env.local (gitignored)
// Board targeted: BA Board

const BASE = 'https://api.trello.com/1';

function getCredentials() {
  const key   = import.meta.env.VITE_TRELLO_API_KEY as string | undefined;
  const token = import.meta.env.VITE_TRELLO_TOKEN   as string | undefined;
  if (!key || !token) throw new Error('Trello credentials not set. Add VITE_TRELLO_API_KEY and VITE_TRELLO_TOKEN to .env.local');
  return { key, token };
}

function qs(params: Record<string, string>): string {
  return '?' + new URLSearchParams(params).toString();
}

async function trelloFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const { key, token } = getCredentials();
  const url = `${BASE}${path}${qs({ key, token, ...params })}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? `Trello API error ${res.status} on ${path}`);
  }
  return res.json() as Promise<T>;
}

// ── Types ────────────────────────────────────────────────────
export interface TrelloBoard {
  id: string;
  name: string;
  desc: string;
  url: string;
  closed: boolean;
  prefs?: { backgroundImage?: string; background?: string };
}

export interface TrelloList {
  id: string;
  name: string;
  closed: boolean;
  pos: number;
}

export interface TrelloLabel {
  id: string;
  name: string;
  color: string | null; // 'red'|'yellow'|'green'|'orange'|'blue'|'purple'|'sky'|'lime'|'pink'|null
}

export interface TrelloMember {
  id: string;
  username: string;
  fullName: string;
  initials: string;
  avatarUrl?: string;
}

export interface TrelloCard {
  id: string;
  name: string;
  desc: string;
  due: string | null;
  dueComplete: boolean;
  idList: string;
  idBoard: string;
  labels: TrelloLabel[];
  idMembers: string[];
  members?: TrelloMember[];
  url: string;
  closed: boolean;
  shortUrl: string;
  pos: number;
  dateLastActivity: string;
}

export interface TrelloChecklist {
  id: string;
  name: string;
  checkItems: { id: string; name: string; state: 'complete' | 'incomplete' }[];
}

// ── Mapped types (platform-native) ──────────────────────────
export type TaskStatus    = 'Backlog' | 'In Progress' | 'In Review' | 'Completed' | 'Overdue';
export type TaskPriority  = 'Critical' | 'High' | 'Medium' | 'Low';
export type RiskSeverity  = 'Critical' | 'High' | 'Medium' | 'Low';

export interface MappedTask {
  trelloId:    string;
  title:       string;
  description: string;
  status:      TaskStatus;
  priority:    TaskPriority;
  dueDate:     string | null;
  assignees:   string[];
  labels:      string[];
  listName:    string;
  trelloUrl:   string;
  isRisk:      boolean;
  lastActivity: string;
}

export interface MappedRisk {
  trelloId:   string;
  title:      string;
  description: string;
  severity:   RiskSeverity;
  category:   string;
  dueDate:    string | null;
  assignees:  string[];
  trelloUrl:  string;
  listName:   string;
  labels:     string[];
}

// ── List-name → TaskStatus mapping ──────────────────────────
function mapListToStatus(listName: string): TaskStatus {
  const n = listName.toLowerCase();
  if (n.includes('done') || n.includes('complete') || n.includes('finished') || n.includes('closed')) return 'Completed';
  if (n.includes('review') || n.includes('testing') || n.includes('qa') || n.includes('approval')) return 'In Review';
  if (n.includes('progress') || n.includes('doing') || n.includes('active') || n.includes('wip')) return 'In Progress';
  if (n.includes('overdue') || n.includes('blocked') || n.includes('escalated')) return 'Overdue';
  return 'Backlog'; // "To Do", "Backlog", "Upcoming", default
}

// ── Label color → TaskPriority mapping ──────────────────────
function mapLabelsToPriority(labels: TrelloLabel[]): TaskPriority {
  for (const l of labels) {
    const c = (l.color ?? '').toLowerCase();
    const n = (l.name ?? '').toLowerCase();
    if (c === 'red'    || n.includes('critical') || n.includes('urgent'))  return 'Critical';
    if (c === 'orange' || n.includes('high'))                              return 'High';
    if (c === 'yellow' || n.includes('medium') || n.includes('mod'))       return 'Medium';
    if (c === 'green'  || n.includes('low'))                               return 'Low';
  }
  return 'Medium'; // default
}

// ── Label color → RiskSeverity mapping ──────────────────────
function mapLabelsToSeverity(labels: TrelloLabel[]): RiskSeverity {
  const priority = mapLabelsToPriority(labels);
  return priority; // same mapping
}

// ── Detect risk cards ────────────────────────────────────────
function isRiskCard(card: TrelloCard, listName: string): boolean {
  const n = listName.toLowerCase();
  const labels = card.labels.map(l => (l.name ?? '').toLowerCase());
  return (
    n.includes('risk') ||
    labels.some(l => l.includes('risk') || l.includes('issue') || l.includes('threat'))
  );
}

// ── Detect risk category from labels/name ────────────────────
function mapRiskCategory(card: TrelloCard): string {
  const text = (card.name + ' ' + card.desc + ' ' + card.labels.map(l => l.name).join(' ')).toLowerCase();
  if (text.includes('technical') || text.includes('tech') || text.includes('system')) return 'Technical';
  if (text.includes('financial') || text.includes('budget') || text.includes('cost')) return 'Financial';
  if (text.includes('resource') || text.includes('staff') || text.includes('team'))   return 'Resource';
  if (text.includes('schedule') || text.includes('timeline') || text.includes('delay')) return 'Schedule';
  if (text.includes('legal') || text.includes('compliance') || text.includes('regulatory')) return 'Compliance';
  if (text.includes('vendor') || text.includes('procurement') || text.includes('supplier')) return 'Vendor';
  return 'Operational';
}

// ── API Calls ────────────────────────────────────────────────
export async function getTrelloBoards(): Promise<TrelloBoard[]> {
  return trelloFetch<TrelloBoard[]>('/members/me/boards', { filter: 'open', fields: 'name,desc,url,closed,prefs' });
}

export async function getTrelloBoard(boardId: string): Promise<TrelloBoard> {
  return trelloFetch<TrelloBoard>(`/boards/${boardId}`, { fields: 'name,desc,url,closed' });
}

export async function getTrelloLists(boardId: string): Promise<TrelloList[]> {
  return trelloFetch<TrelloList[]>(`/boards/${boardId}/lists`, { filter: 'open', fields: 'name,closed,pos' });
}

export async function getTrelloCards(boardId: string): Promise<TrelloCard[]> {
  return trelloFetch<TrelloCard[]>(`/boards/${boardId}/cards`, {
    filter: 'open',
    fields: 'name,desc,due,dueComplete,idList,idBoard,labels,idMembers,url,closed,shortUrl,pos,dateLastActivity',
    members: 'true',
    member_fields: 'fullName,initials,username,avatarUrl',
  });
}

export async function getTrelloBoardMembers(boardId: string): Promise<TrelloMember[]> {
  return trelloFetch<TrelloMember[]>(`/boards/${boardId}/members`, { fields: 'fullName,initials,username,avatarUrl' });
}

// ── Find BA Board ────────────────────────────────────────────
export async function findBABoard(): Promise<TrelloBoard | null> {
  const boards = await getTrelloBoards();
  // Try exact match first
  const ba = boards.find(b =>
    b.name.toLowerCase() === 'ba board' ||
    b.name.toLowerCase().includes('ba board') ||
    b.name.toLowerCase().includes('business analyst') ||
    b.name.toLowerCase().startsWith('ba ')
  );
  return ba ?? boards[0] ?? null; // fallback to first board
}

// ── Full board fetch + mapping ───────────────────────────────
export interface BoardData {
  board:    TrelloBoard;
  lists:    TrelloList[];
  cards:    TrelloCard[];
  members:  TrelloMember[];
  tasks:    MappedTask[];
  risks:    MappedRisk[];
}

export async function fetchBoardData(boardId?: string): Promise<BoardData> {
  const board = boardId
    ? await getTrelloBoard(boardId)
    : await findBABoard().then(b => { if (!b) throw new Error('No Trello boards found'); return b; });

  const [lists, cards, members] = await Promise.all([
    getTrelloLists(board.id),
    getTrelloCards(board.id),
    getTrelloBoardMembers(board.id),
  ]);

  const listMap = Object.fromEntries(lists.map(l => [l.id, l.name]));

  const tasks: MappedTask[] = [];
  const risks: MappedRisk[] = [];

  for (const card of cards) {
    if (card.closed) continue;
    const listName = listMap[card.idList] ?? 'Backlog';
    const assignees = (card.members ?? []).map(m => m.initials || m.fullName.split(' ').map(w => w[0]).join(''));

    if (isRiskCard(card, listName)) {
      risks.push({
        trelloId:    card.id,
        title:       card.name,
        description: card.desc,
        severity:    mapLabelsToSeverity(card.labels),
        category:    mapRiskCategory(card),
        dueDate:     card.due ? card.due.slice(0, 10) : null,
        assignees,
        trelloUrl:   card.url,
        listName,
        labels:      card.labels.map(l => l.name).filter(Boolean),
      });
    } else {
      tasks.push({
        trelloId:    card.id,
        title:       card.name,
        description: card.desc,
        status:      mapListToStatus(listName),
        priority:    mapLabelsToPriority(card.labels),
        dueDate:     card.due ? card.due.slice(0, 10) : null,
        assignees,
        labels:      card.labels.map(l => l.name).filter(Boolean),
        listName,
        trelloUrl:   card.url,
        isRisk:      false,
        lastActivity: card.dateLastActivity,
      });
    }
  }

  return { board, lists, cards, members, tasks, risks };
}
