"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/Dialog";
// @ts-ignore
import { AlertTriangle, History, Minus, Package, Plus, Ruler, Scissors, Search, Settings2, Trash2 } from "lucide-react";
import {
    addStockPieces, adjustStockCount, createStockProduct, cutStockPiece, discardStockPiece, getStockHistory, setStockCount,
    updateStockPiece, updateStockSettings,
} from "@/lib/actions/stock-actions";
import {
    feetInchesToInches, formatFeetInches, formatStockQuantity, isPieceKind, STOCK_KIND_LABELS, STOCK_KINDS,
    STOCK_MOVEMENT_LABELS, type StockKind,
} from "@/lib/stock-units";

interface StockPiece {
    id: string;
    length: number;
    source: string;
    note: string | null;
    createdAt: string;
}

interface StockProduct {
    id: string;
    name: string;
    category: string;
    rate: number;
    stockKind: string;
    stockQuantity: number;
    lowStockAt: number | null;
    total: number;
    isLow: boolean;
    stockPieces: StockPiece[];
}

interface Movement {
    id: string;
    type: string;
    quantity: number;
    note: string | null;
    createdAt: string;
}

type DialogState =
    | { type: "newProduct" }
    | { type: "add"; product: StockProduct }
    | { type: "piece"; product: StockProduct; piece: StockPiece }
    | { type: "count"; product: StockProduct }
    | { type: "settings"; product: StockProduct }
    | { type: "history"; product: StockProduct; movements: Movement[] | null }
    | null;

const TABS: Array<{ value: "ALL" | StockKind; label: string }> = [
    { value: "ALL", label: "All" },
    { value: "FABRIC", label: "Fabric" },
    { value: "TRACK", label: "Track" },
    { value: "ACCESSORY", label: "Accessory" },
    { value: "OTHER", label: "Not tracked" },
];

const KIND_STYLES: Record<string, string> = {
    FABRIC: "bg-pink-50 text-pink-700 border-pink-200",
    TRACK: "bg-blue-50 text-blue-700 border-blue-200",
    ACCESSORY: "bg-amber-50 text-amber-700 border-amber-200",
    OTHER: "bg-slate-50 text-slate-500 border-slate-200",
};

const pieceLabel = (kind: string, length: number) => (kind === "TRACK" ? formatFeetInches(length) : formatStockQuantity(kind, length));

/** Alert level and lengths are stored in the base unit; tracks are entered in feet. */
const alertToInput = (kind: string, value: number | null) => (value == null ? "" : String(kind === "TRACK" ? Number((value / 12).toFixed(2)) : value));
const alertFromInput = (kind: string, text: string) => (text.trim() === "" ? null : (parseFloat(text) || 0) * (kind === "TRACK" ? 12 : 1));

export function StockClient({ products }: { products: StockProduct[] }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [query, setQuery] = useState("");
    const [tab, setTab] = useState<"ALL" | StockKind>("ALL");
    const [dialog, setDialog] = useState<DialogState>(null);
    const [error, setError] = useState<string | null>(null);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return products.filter(p =>
            (tab === "ALL" || p.stockKind === tab) &&
            (!q || p.name.toLowerCase().includes(q) || (p.category || "").toLowerCase().includes(q)));
    }, [products, query, tab]);

    const low = products.filter(p => p.isLow);
    const counts = useMemo(() => {
        const result: Record<string, number> = { ALL: products.length };
        for (const kind of STOCK_KINDS) result[kind] = products.filter(p => p.stockKind === kind).length;
        return result;
    }, [products]);

    /** Runs a stock action, then reloads the page data. Keeps the dialog open on failure. */
    const run = (action: () => Promise<{ success: boolean; error?: string }>) => {
        setError(null);
        startTransition(async () => {
            const result = await action();
            if (!result.success) {
                setError(result.error || "Something went wrong");
                return;
            }
            setDialog(null);
            router.refresh();
        });
    };

    const openHistory = async (product: StockProduct) => {
        setDialog({ type: "history", product, movements: null });
        const movements = await getStockHistory(product.id);
        setDialog(current => (current?.type === "history" && current.product.id === product.id
            ? { ...current, movements: JSON.parse(JSON.stringify(movements)) }
            : current));
    };

    const close = () => {
        setDialog(null);
        setError(null);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Stock Management</h1>
                    <p className="text-slate-500 mt-1">Fabric cuts in metres, track pieces in feet and inches, accessories in nos.</p>
                </div>
                <Button onClick={() => setDialog({ type: "newProduct" })}>
                    <Plus className="h-4 w-4 mr-1" /> Add product
                </Button>
            </div>

            {low.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                        <div className="flex-1">
                            <h3 className="font-bold text-yellow-900">Low Stock Alert</h3>
                            <div className="mt-2 flex flex-wrap gap-2">
                                {low.map(product => (
                                    <span key={product.id} className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full font-medium">
                                        {product.name} ({formatStockQuantity(product.stockKind, product.total)})
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input type="search" placeholder="Search products..." value={query} onChange={e => setQuery(e.target.value)} className="pl-10" />
            </div>

            <div className="flex flex-wrap gap-2">
                {TABS.map(t => (
                    <button
                        key={t.value}
                        onClick={() => setTab(t.value)}
                        className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all shadow-sm ${tab === t.value
                            ? "bg-slate-900 text-white"
                            : "bg-white text-slate-500 hover:bg-slate-100 border border-slate-200"}`}
                    >
                        {t.label} <span className="opacity-60">{counts[t.value] ?? 0}</span>
                    </button>
                ))}
            </div>

            <div className="space-y-3">
                {filtered.map(product => {
                    const pieceKind = isPieceKind(product.stockKind);
                    return (
                        <div key={product.id} className={`bg-white rounded-lg border p-4 ${product.isLow ? "border-yellow-300" : "border-slate-200"}`}>
                            <div className="flex flex-wrap items-start gap-3">
                                <div className="h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                                    {product.stockKind === "TRACK" ? <Ruler className="h-5 w-5 text-indigo-600" /> : <Package className="h-5 w-5 text-indigo-600" />}
                                </div>
                                <div className="flex-1 min-w-[180px]">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-bold text-slate-900">{product.name}</span>
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${KIND_STYLES[product.stockKind] ?? KIND_STYLES.OTHER}`}>
                                            {STOCK_KIND_LABELS[product.stockKind as StockKind] ?? product.stockKind}
                                        </span>
                                        {product.isLow && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border bg-yellow-50 text-yellow-700 border-yellow-200">Low</span>}
                                    </div>
                                    <div className="text-sm text-slate-500">{product.category || "No category"} · ₹{product.rate}</div>
                                </div>
                                {product.stockKind !== "OTHER" && (
                                    <div className="text-right">
                                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{pieceKind ? `Total · ${product.stockPieces.length} pcs` : "In stock"}</div>
                                        <div className="text-xl font-bold text-slate-900">{formatStockQuantity(product.stockKind, product.total)}</div>
                                    </div>
                                )}
                            </div>

                            {pieceKind && (
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {product.stockPieces.map(piece => (
                                        <button
                                            key={piece.id}
                                            onClick={() => setDialog({ type: "piece", product, piece })}
                                            title={piece.note || (piece.source === "OFFCUT" ? "Offcut" : "Piece")}
                                            className={`px-3 py-1.5 rounded-md border text-sm font-semibold transition-colors ${piece.source === "OFFCUT"
                                                ? "bg-green-50 border-green-200 text-green-800 hover:bg-green-100"
                                                : "bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100"}`}
                                        >
                                            {pieceLabel(product.stockKind, piece.length)}
                                        </button>
                                    ))}
                                    {product.stockPieces.length === 0 && <span className="text-sm text-slate-400">No pieces in stock.</span>}
                                    {product.stockQuantity > 0 && (
                                        <span className="text-xs text-slate-400 self-center">Old stock figure: {product.stockQuantity}. Add the pieces to track them.</span>
                                    )}
                                </div>
                            )}

                            <div className="mt-3 flex flex-wrap gap-2">
                                {pieceKind && (
                                    <Button size="sm" variant="outline" onClick={() => setDialog({ type: "add", product })}>
                                        <Plus className="h-4 w-4 mr-1" /> {product.stockKind === "FABRIC" ? "Add cut" : "Add piece"}
                                    </Button>
                                )}
                                {product.stockKind === "ACCESSORY" && (
                                    <>
                                        <Button size="sm" variant="outline" disabled={isPending} onClick={() => run(() => adjustStockCount(product.id, -1))} title="Use one">
                                            <Minus className="h-4 w-4" />
                                        </Button>
                                        <Button size="sm" variant="outline" disabled={isPending} onClick={() => run(() => adjustStockCount(product.id, 1))} title="Add one">
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                        <Button size="sm" variant="outline" onClick={() => setDialog({ type: "count", product })}>Add / use / count</Button>
                                    </>
                                )}
                                <Button size="sm" variant="ghost" onClick={() => void openHistory(product)}>
                                    <History className="h-4 w-4 mr-1" /> History
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setDialog({ type: "settings", product })}>
                                    <Settings2 className="h-4 w-4 mr-1" /> Type &amp; alert
                                </Button>
                            </div>
                        </div>
                    );
                })}

                {filtered.length === 0 && (
                    <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
                        <Package className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-slate-900 mb-2">No products found</h3>
                        <p className="text-slate-500">{query ? "Try a different search term" : "Add products on the Products page to start tracking stock"}</p>
                    </div>
                )}
            </div>

            <Dialog open={!!dialog} onOpenChange={open => !open && close()}>
                {dialog?.type === "newProduct" && <NewProductForm defaultKind={tab === "ALL" ? "FABRIC" : tab} pending={isPending} error={error} onCancel={close}
                    onSubmit={input => run(() => createStockProduct(input))} />}
                {dialog?.type === "add" && <AddPiecesForm product={dialog.product} pending={isPending} error={error} onCancel={close}
                    onSubmit={(lengths, note) => run(() => addStockPieces(dialog.product.id, lengths, note))} />}
                {dialog?.type === "piece" && <PieceForm product={dialog.product} piece={dialog.piece} pending={isPending} error={error} onCancel={close}
                    onCut={(amount, note) => run(() => cutStockPiece(dialog.piece.id, amount, note))}
                    onCorrect={length => run(() => updateStockPiece(dialog.piece.id, { length }))}
                    onDiscard={(amount, note) => run(() => discardStockPiece(dialog.piece.id, amount, note))} />}
                {dialog?.type === "count" && <CountForm product={dialog.product} pending={isPending} error={error} onCancel={close}
                    onAdjust={(delta, note, discard) => run(() => adjustStockCount(dialog.product.id, delta, note, discard))}
                    onSet={(quantity, note) => run(() => setStockCount(dialog.product.id, quantity, note))} />}
                {dialog?.type === "settings" && <SettingsForm product={dialog.product} pending={isPending} error={error} onCancel={close}
                    onSave={settings => run(() => updateStockSettings(dialog.product.id, settings))} />}
                {dialog?.type === "history" && <HistoryView product={dialog.product} movements={dialog.movements} onClose={close} />}
            </Dialog>
        </div>
    );
}

function ErrorLine({ error }: { error: string | null }) {
    return error ? <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm font-medium border border-red-200">{error}</div> : null;
}

function Label({ children }: { children: React.ReactNode }) {
    return <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">{children}</label>;
}

/** Track length entry as feet + inches. */
function FeetInchesInput({ feet, inches, onFeet, onInches }: { feet: string; inches: string; onFeet: (v: string) => void; onInches: (v: string) => void }) {
    return (
        <div className="flex items-center gap-2">
            <Input type="number" min={0} value={feet} onChange={e => onFeet(e.target.value)} className="w-20" placeholder="0" aria-label="Feet" />
            <span className="text-sm text-slate-500">ft</span>
            <Input type="number" min={0} step={0.25} value={inches} onChange={e => onInches(e.target.value)} className="w-20" placeholder="0" aria-label="Inches" />
            <span className="text-sm text-slate-500">in</span>
        </div>
    );
}

interface FormProps {
    product: StockProduct;
    pending: boolean;
    error: string | null;
    onCancel: () => void;
}

function NewProductForm({ defaultKind, pending, error, onCancel, onSubmit }: {
    defaultKind: StockKind;
    pending: boolean;
    error: string | null;
    onCancel: () => void;
    onSubmit: (input: { name: string; stockKind: string; category?: string; rate?: number; lowStockAt?: number | null }) => void;
}) {
    const [kind, setKind] = useState<StockKind>(defaultKind);
    const [name, setName] = useState("");
    const [category, setCategory] = useState("");
    const [rate, setRate] = useState("");
    const [alert, setAlert] = useState("");
    const unit = kind === "FABRIC" ? "m" : kind === "TRACK" ? "ft" : "nos";
    const rateUnit = kind === "FABRIC" ? "per metre" : kind === "TRACK" ? "per foot" : kind === "ACCESSORY" ? "per piece" : "";

    return (
        <>
            <DialogHeader>
                <DialogTitle>Add product</DialogTitle>
                <DialogDescription>It is added to the product catalogue too, so it can be picked in measurements and quotations.</DialogDescription>
            </DialogHeader>
            <ErrorLine error={error} />
            <div>
                <Label>Stock type</Label>
                <div className="flex flex-wrap gap-2">
                    {STOCK_KINDS.map(k => (
                        <Button key={k} size="sm" variant={kind === k ? "default" : "outline"} onClick={() => setKind(k)}>{STOCK_KIND_LABELS[k]}</Button>
                    ))}
                </div>
            </div>
            <div>
                <Label>Name</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder={kind === "FABRIC" ? "e.g. Velvet Grey" : kind === "TRACK" ? "e.g. Rolex (White)" : "e.g. Finial Gold"} autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <Label>Category (optional)</Label>
                    <Input value={category} onChange={e => setCategory(e.target.value)} placeholder={{ FABRIC: "Fabric", TRACK: "Tracks", ACCESSORY: "Accessories", OTHER: "" }[kind]} />
                </div>
                <div>
                    <Label>Rate ₹ {rateUnit && `(${rateUnit})`}</Label>
                    <Input type="number" min={0} value={rate} onChange={e => setRate(e.target.value)} placeholder="0" />
                </div>
            </div>
            {kind !== "OTHER" && (
                <div>
                    <Label>Alert when stock is at or below (optional)</Label>
                    <div className="flex items-center gap-2">
                        <Input type="number" min={0} value={alert} onChange={e => setAlert(e.target.value)} className="w-28" placeholder="No alert" />
                        <span className="text-sm text-slate-500">{unit}</span>
                    </div>
                </div>
            )}
            <DialogFooter>
                <Button variant="ghost" onClick={onCancel}>Cancel</Button>
                <Button
                    disabled={!name.trim() || pending}
                    onClick={() => onSubmit({
                        name: name.trim(),
                        stockKind: kind,
                        category: category.trim() || undefined,
                        rate: rate.trim() ? parseFloat(rate) || 0 : 0,
                        lowStockAt: kind === "OTHER" ? null : alertFromInput(kind, alert),
                    })}
                >
                    {pending ? "Saving..." : "Add product"}
                </Button>
            </DialogFooter>
        </>
    );
}

function AddPiecesForm({ product, pending, error, onCancel, onSubmit }: FormProps & { onSubmit: (lengths: number[], note?: string) => void }) {
    const isTrack = product.stockKind === "TRACK";
    const [metres, setMetres] = useState("");
    const [feet, setFeet] = useState("");
    const [inches, setInches] = useState("");
    const [count, setCount] = useState("1");
    const [note, setNote] = useState("");

    const lengths = isTrack
        ? Array.from({ length: Math.max(0, parseInt(count) || 0) }, () => feetInchesToInches(parseFloat(feet) || 0, parseFloat(inches) || 0))
        : metres.split(/[,\s]+/).map(v => parseFloat(v)).filter(v => v > 0);
    const valid = lengths.length > 0 && lengths.every(l => l > 0);

    return (
        <>
            <DialogHeader>
                <DialogTitle>{isTrack ? "Add track pieces" : "Add fabric cuts"}</DialogTitle>
                <DialogDescription>{product.name}</DialogDescription>
            </DialogHeader>
            <ErrorLine error={error} />
            {isTrack ? (
                <div className="grid gap-4">
                    <div>
                        <Label>Length of each piece</Label>
                        <FeetInchesInput feet={feet} inches={inches} onFeet={setFeet} onInches={setInches} />
                    </div>
                    <div>
                        <Label>How many pieces</Label>
                        <Input type="number" min={1} value={count} onChange={e => setCount(e.target.value)} className="w-24" />
                    </div>
                </div>
            ) : (
                <div>
                    <Label>Cut lengths in metres</Label>
                    <Input value={metres} onChange={e => setMetres(e.target.value)} placeholder="e.g. 8, 4, 2.5" autoFocus />
                    <p className="text-xs text-slate-500 mt-1">One cut per number - separate with commas.</p>
                </div>
            )}
            <div>
                <Label>Note (optional)</Label>
                <Input value={note} onChange={e => setNote(e.target.value)} placeholder="Supplier, bill no., shade..." />
            </div>
            {valid && (
                <p className="text-sm text-slate-600">
                    Adding {lengths.length} {lengths.length === 1 ? "piece" : "pieces"}: {lengths.map(l => pieceLabel(product.stockKind, l)).join(", ")}
                </p>
            )}
            <DialogFooter>
                <Button variant="ghost" onClick={onCancel}>Cancel</Button>
                <Button disabled={!valid || pending} onClick={() => onSubmit(lengths, note.trim() || undefined)}>{pending ? "Saving..." : "Add to stock"}</Button>
            </DialogFooter>
        </>
    );
}

type PieceMode = "cut" | "discard" | "correct";

function PieceForm({ product, piece, pending, error, onCancel, onCut, onDiscard, onCorrect }: FormProps & {
    piece: StockPiece;
    onCut: (amount: number, note?: string) => void;
    onDiscard: (amount: number, note?: string) => void;
    onCorrect: (length: number) => void;
}) {
    const isTrack = product.stockKind === "TRACK";
    const [mode, setMode] = useState<PieceMode>("cut");
    const [metres, setMetres] = useState("");
    const [feet, setFeet] = useState("");
    const [inches, setInches] = useState("");
    const [note, setNote] = useState("");

    const amount = isTrack ? feetInchesToInches(parseFloat(feet) || 0, parseFloat(inches) || 0) : parseFloat(metres) || 0;
    const remaining = piece.length - amount;

    // Fills the length boxes with the whole piece - the usual case when throwing a piece away
    const fillWholePiece = () => {
        if (isTrack) {
            const ft = Math.floor(piece.length / 12);
            setFeet(String(ft));
            setInches(String(Number((piece.length - ft * 12).toFixed(2))));
        } else {
            setMetres(String(piece.length));
        }
    };

    const switchMode = (next: PieceMode) => {
        setMode(next);
        setMetres("");
        setFeet("");
        setInches("");
        if (next === "discard") fillWholePiece();
    };

    const submit = () => {
        if (mode === "cut") onCut(amount, note.trim() || undefined);
        else if (mode === "discard") onDiscard(amount, note.trim() || undefined);
        else onCorrect(amount);
    };

    const labels: Record<PieceMode, string> = { cut: "Length used", discard: "Length thrown away", correct: "Actual length" };

    return (
        <>
            <DialogHeader>
                <DialogTitle>{pieceLabel(product.stockKind, piece.length)} {isTrack ? "piece" : "cut"}</DialogTitle>
                <DialogDescription>
                    {product.name}{piece.source === "OFFCUT" ? " · offcut" : ""}{piece.note ? ` · ${piece.note}` : ""}
                </DialogDescription>
            </DialogHeader>
            <ErrorLine error={error} />
            <div className="flex flex-wrap gap-2">
                <Button size="sm" variant={mode === "cut" ? "default" : "outline"} onClick={() => switchMode("cut")}><Scissors className="h-4 w-4 mr-1" /> Use / cut</Button>
                <Button size="sm" variant={mode === "discard" ? "destructive" : "outline"} onClick={() => switchMode("discard")}><Trash2 className="h-4 w-4 mr-1" /> Discard / trash</Button>
                <Button size="sm" variant={mode === "correct" ? "default" : "outline"} onClick={() => switchMode("correct")}>Correct length</Button>
            </div>
            <div>
                <Label>{labels[mode]}</Label>
                {isTrack
                    ? <FeetInchesInput feet={feet} inches={inches} onFeet={setFeet} onInches={setInches} />
                    : <div className="flex items-center gap-2"><Input type="number" min={0} step={0.1} value={metres} onChange={e => setMetres(e.target.value)} className="w-28" autoFocus /><span className="text-sm text-slate-500">m</span></div>}
                {mode !== "correct" && amount > 0 && (
                    <p className="text-xs text-slate-500 mt-1">
                        {remaining > 0.0005
                            ? `${pieceLabel(product.stockKind, remaining)} stays in stock.`
                            : mode === "discard" ? "The whole piece is thrown away." : "The whole piece is used up."}
                    </p>
                )}
                {mode === "discard" && (
                    <button type="button" onClick={fillWholePiece} className="text-xs text-blue-600 hover:underline mt-1">Whole piece</button>
                )}
            </div>
            {mode !== "correct" && (
                <div>
                    <Label>{mode === "cut" ? "For (optional)" : "Reason (optional)"}</Label>
                    <Input value={note} onChange={e => setNote(e.target.value)} placeholder={mode === "cut" ? "Customer / job" : "Damaged, stained, too short..."} />
                </div>
            )}
            <DialogFooter>
                <Button variant="ghost" onClick={onCancel}>Cancel</Button>
                <Button variant={mode === "discard" ? "destructive" : "default"} disabled={!(amount > 0) || pending} onClick={submit}>
                    {pending ? "Saving..." : mode === "cut" ? "Use" : mode === "discard" ? "Discard" : "Save length"}
                </Button>
            </DialogFooter>
        </>
    );
}

type CountMode = "add" | "use" | "discard" | "set";

function CountForm({ product, pending, error, onCancel, onAdjust, onSet }: FormProps & {
    onAdjust: (delta: number, note?: string, discard?: boolean) => void;
    onSet: (quantity: number, note?: string) => void;
}) {
    const [mode, setMode] = useState<CountMode>("add");
    const [value, setValue] = useState("");
    const [note, setNote] = useState("");
    const n = parseInt(value);
    const valid = Number.isInteger(n) && (mode === "set" ? n >= 0 : n > 0);

    const submit = () => {
        if (mode === "set") onSet(n, note.trim() || undefined);
        else onAdjust(mode === "add" ? n : -n, note.trim() || undefined, mode === "discard");
    };

    const placeholders: Record<CountMode, string> = {
        add: "Supplier, bill no...", use: "Customer / job", discard: "Damaged, broken...", set: "Stock check",
    };

    return (
        <>
            <DialogHeader>
                <DialogTitle>{product.name}</DialogTitle>
                <DialogDescription>In stock: {product.stockQuantity} nos</DialogDescription>
            </DialogHeader>
            <ErrorLine error={error} />
            <div className="flex flex-wrap gap-2">
                <Button size="sm" variant={mode === "add" ? "default" : "outline"} onClick={() => setMode("add")}>Add</Button>
                <Button size="sm" variant={mode === "use" ? "default" : "outline"} onClick={() => setMode("use")}>Use</Button>
                <Button size="sm" variant={mode === "discard" ? "destructive" : "outline"} onClick={() => setMode("discard")}><Trash2 className="h-4 w-4 mr-1" /> Discard / trash</Button>
                <Button size="sm" variant={mode === "set" ? "default" : "outline"} onClick={() => setMode("set")}>Stock count</Button>
            </div>
            <div>
                <Label>{mode === "set" ? "Counted in hand" : mode === "discard" ? "Nos thrown away" : "Nos"}</Label>
                <Input type="number" min={0} value={value} onChange={e => setValue(e.target.value)} className="w-28" autoFocus />
            </div>
            <div>
                <Label>{mode === "discard" ? "Reason (optional)" : "Note (optional)"}</Label>
                <Input value={note} onChange={e => setNote(e.target.value)} placeholder={placeholders[mode]} />
            </div>
            <DialogFooter>
                <Button variant="ghost" onClick={onCancel}>Cancel</Button>
                <Button variant={mode === "discard" ? "destructive" : "default"} disabled={!valid || pending} onClick={submit}>{pending ? "Saving..." : mode === "discard" ? "Discard" : "Save"}</Button>
            </DialogFooter>
        </>
    );
}

function SettingsForm({ product, pending, error, onCancel, onSave }: FormProps & {
    onSave: (settings: { stockKind: string; lowStockAt: number | null }) => void;
}) {
    const [kind, setKind] = useState(product.stockKind);
    const [alert, setAlert] = useState(alertToInput(product.stockKind, product.lowStockAt));
    const unit = kind === "FABRIC" ? "m" : kind === "TRACK" ? "ft" : "nos";
    const changingWithStock = kind !== product.stockKind && (product.stockPieces.length > 0 || product.stockQuantity > 0);

    return (
        <>
            <DialogHeader>
                <DialogTitle>Stock type &amp; alert</DialogTitle>
                <DialogDescription>{product.name}</DialogDescription>
            </DialogHeader>
            <ErrorLine error={error} />
            <div>
                <Label>Stock type</Label>
                <div className="flex flex-wrap gap-2">
                    {STOCK_KINDS.map(k => (
                        <Button key={k} size="sm" variant={kind === k ? "default" : "outline"} onClick={() => setKind(k)}>{STOCK_KIND_LABELS[k]}</Button>
                    ))}
                </div>
                {changingWithStock && <p className="text-xs text-amber-700 mt-2">This product already has stock recorded as {STOCK_KIND_LABELS[product.stockKind as StockKind]}. Pieces and counts are kept but only the new type&apos;s figure is shown.</p>}
            </div>
            {kind !== "OTHER" && (
                <div>
                    <Label>Alert when stock is at or below</Label>
                    <div className="flex items-center gap-2">
                        <Input type="number" min={0} step={kind === "ACCESSORY" ? 1 : 0.5} value={alert} onChange={e => setAlert(e.target.value)} className="w-28" placeholder="No alert" />
                        <span className="text-sm text-slate-500">{unit}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Leave empty for no alert.</p>
                </div>
            )}
            <DialogFooter>
                <Button variant="ghost" onClick={onCancel}>Cancel</Button>
                <Button disabled={pending} onClick={() => onSave({ stockKind: kind, lowStockAt: alertFromInput(kind, alert) })}>{pending ? "Saving..." : "Save"}</Button>
            </DialogFooter>
        </>
    );
}

function HistoryView({ product, movements, onClose }: { product: StockProduct; movements: Movement[] | null; onClose: () => void }) {
    return (
        <>
            <DialogHeader>
                <DialogTitle>Stock history</DialogTitle>
                <DialogDescription>{product.name} · last 50 changes</DialogDescription>
            </DialogHeader>
            <div className="max-h-[50vh] overflow-y-auto divide-y">
                {movements === null && <p className="text-sm text-slate-500 py-4">Loading...</p>}
                {movements?.length === 0 && <p className="text-sm text-slate-500 py-4">No changes recorded yet.</p>}
                {movements?.map(m => (
                    <div key={m.id} className="py-2 flex items-start justify-between gap-3 text-sm">
                        <div>
                            <div className="font-medium text-slate-900">{STOCK_MOVEMENT_LABELS[m.type] ?? m.type}{m.note ? ` · ${m.note}` : ""}</div>
                            <div className="text-xs text-slate-500">{new Date(m.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</div>
                        </div>
                        <div className={`font-bold whitespace-nowrap ${m.quantity >= 0 ? "text-green-700" : "text-red-600"}`}>
                            {m.quantity >= 0 ? "+" : "-"}{formatStockQuantity(product.stockKind, Math.abs(m.quantity))}
                        </div>
                    </div>
                ))}
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={onClose}>Close</Button>
            </DialogFooter>
        </>
    );
}
