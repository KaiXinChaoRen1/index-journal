import { NextRequest, NextResponse } from "next/server";
import {
  getSnapshotGroupState,
  getSnapshotRefreshAvailability,
  isSnapshotGroupKey,
  refreshSnapshotGroup,
} from "@/lib/manual-snapshot";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ group: string }> },
) {
  const { group } = await params;

  if (!isSnapshotGroupKey(group)) {
    return NextResponse.json({ error: "Unsupported snapshot group." }, { status: 400 });
  }

  const state = await getSnapshotGroupState(group);
  const availability = getSnapshotRefreshAvailability(group);

  return NextResponse.json({
    ok: true,
    group,
    availability,
    state: {
      payload: state.payload,
      lastSuccessAt: state.lastSuccessAt ? state.lastSuccessAt.toISOString() : null,
      lastAttemptAt: state.lastAttemptAt ? state.lastAttemptAt.toISOString() : null,
      lastErrorMessage: state.lastErrorMessage,
    },
  });
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ group: string }> },
) {
  const { group } = await params;

  if (!isSnapshotGroupKey(group)) {
    return NextResponse.json({ error: "Unsupported snapshot group." }, { status: 400 });
  }

  const result = await refreshSnapshotGroup(group);
  const availability = getSnapshotRefreshAvailability(group);

  return NextResponse.json({
    ok: result.ok,
    status: result.status,
    message: result.message,
    cooldownRemainingSeconds: result.cooldownRemainingSeconds,
    group,
    availability,
    state: {
      payload: result.state.payload,
      lastSuccessAt: result.state.lastSuccessAt ? result.state.lastSuccessAt.toISOString() : null,
      lastAttemptAt: result.state.lastAttemptAt ? result.state.lastAttemptAt.toISOString() : null,
      lastErrorMessage: result.state.lastErrorMessage,
    },
  });
}
