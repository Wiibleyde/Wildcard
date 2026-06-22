"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { useRoomAction } from "@/hooks/useRoomAction";
import type { GameCatalogEntry } from "@/lib/games";

export interface OpenRoom {
    code: string;
    moduleId: string;
    moduleName: string;
    count: number;
    max: number;
}

interface Props {
    catalog: GameCatalogEntry[];
    openRooms: OpenRoom[];
}

export function LobbyBrowser({ catalog, openRooms }: Props) {
    const t = useTranslations("lobby");
    const [selected, setSelected] = useState(catalog[0]?.id ?? "");
    const [code, setCode] = useState("");
    const { busy, error, createRoom, joinRoom } = useRoomAction();

    return (
        <div className="flex flex-col gap-8 lg:grid lg:grid-cols-2 lg:items-start">
            <section
                className="rounded-2xl p-5 sm:p-8 flex flex-col gap-5"
                style={{
                    background: "#1c1510",
                    border: "2px solid #3d2d18",
                }}
            >
                <h2
                    className="text-lg xl:text-xl font-black"
                    style={{ color: "#faf2e2" }}
                >
                    {t("create_section")}
                </h2>

                <div className="flex flex-col gap-2">
                    <span
                        className="text-xs font-bold uppercase tracking-widest"
                        style={{ color: "#7a6a50" }}
                    >
                        {t("choose_game")}
                    </span>
                    <div className="grid grid-cols-2 gap-3">
                        {catalog.map((game) => {
                            const active = game.id === selected;
                            return (
                                <button
                                    key={game.id}
                                    type="button"
                                    onClick={() => setSelected(game.id)}
                                    className="rounded-xl px-4 py-3 text-left transition-transform active:scale-95"
                                    style={{
                                        background: active
                                            ? "rgba(245,197,22,0.12)"
                                            : "rgba(255,255,255,0.03)",
                                        border: `2px solid ${active ? "#f5c516" : "#3d2d18"}`,
                                    }}
                                >
                                    <div
                                        className="font-black"
                                        style={{
                                            color: active
                                                ? "#f5c516"
                                                : "#faf2e2",
                                        }}
                                    >
                                        {game.name}
                                    </div>
                                    <div
                                        className="text-xs font-semibold"
                                        style={{ color: "#9a8870" }}
                                    >
                                        {game.minPlayers}–{game.maxPlayers}{" "}
                                        {t("players")}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <button
                    type="button"
                    onClick={() => createRoom(selected)}
                    disabled={busy !== null || !selected}
                    className="rounded-xl py-3 font-black text-sm disabled:opacity-50"
                    style={{
                        background: "#48c97a",
                        color: "#0d1f12",
                        boxShadow: "0 4px 0 0 #1a6038",
                    }}
                >
                    {busy === "create" ? t("creating") : t("create_room")}
                </button>
            </section>

            <section className="flex flex-col gap-8">
                <div
                    className="rounded-2xl p-5 sm:p-8 flex flex-col gap-4"
                    style={{
                        background: "#1c1510",
                        border: "2px solid #3d2d18",
                    }}
                >
                    <h2
                        className="text-lg xl:text-xl font-black"
                        style={{ color: "#faf2e2" }}
                    >
                        {t("join_section")}
                    </h2>
                    <div className="flex gap-3">
                        <input
                            value={code}
                            onChange={(e) =>
                                setCode(e.target.value.toUpperCase())
                            }
                            placeholder={t("code_placeholder")}
                            maxLength={5}
                            className="min-w-0 flex-1 rounded-xl px-4 py-3 font-black tracking-[0.3em] text-center outline-none"
                            style={{
                                background: "rgba(0,0,0,0.3)",
                                border: "2px solid #3d2d18",
                                color: "#faf2e2",
                            }}
                        />
                        <GameButton
                            onClick={() => joinRoom(code)}
                            disabled={busy !== null || code.length < 3}
                            className="shrink-0"
                        >
                            {busy === "join" ? t("joining") : t("join_room")}
                        </GameButton>
                    </div>
                    {error && (
                        <p
                            className="text-sm font-semibold"
                            style={{ color: "#e04040" }}
                        >
                            {error}
                        </p>
                    )}
                </div>

                <div className="flex flex-col gap-3">
                    <h3
                        className="text-xs font-bold uppercase tracking-widest"
                        style={{ color: "#7a6a50" }}
                    >
                        {t("open_rooms")}
                    </h3>
                    {openRooms.length === 0 ? (
                        <p
                            className="text-sm font-semibold"
                            style={{ color: "#7a6a50" }}
                        >
                            {t("no_rooms")}
                        </p>
                    ) : (
                        <ul className="flex flex-col gap-2">
                            {openRooms.map((room) => (
                                <li
                                    key={room.code}
                                    className="flex items-center justify-between rounded-xl px-4 py-3"
                                    style={{
                                        background: "#1c1510",
                                        border: "2px solid #3d2d18",
                                    }}
                                >
                                    <div>
                                        <div
                                            className="font-black"
                                            style={{ color: "#faf2e2" }}
                                        >
                                            {room.moduleName}
                                        </div>
                                        <div
                                            className="text-xs font-semibold tracking-[0.2em]"
                                            style={{ color: "#9a8870" }}
                                        >
                                            {room.code} · {room.count}/
                                            {room.max} {t("players")}
                                        </div>
                                    </div>
                                    <GameButton
                                        size="sm"
                                        className="shrink-0"
                                        onClick={() => joinRoom(room.code)}
                                        disabled={busy !== null}
                                    >
                                        {t("join_room")}
                                    </GameButton>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </section>
        </div>
    );
}
