import "server-only";

// Wakes the GitHub Actions runner that does the transcoding. ffmpeg can't run
// on Vercel — no binary, and an execution budget measured in seconds against
// an encode measured in minutes — so the work happens on a runner that
// already has ffmpeg installed and already runs the ingest pipeline.
//
// workflow_dispatch rather than repository_dispatch on purpose: the former
// needs only the "Actions" permission on a fine-grained token, the latter
// requires "Contents: write", which also allows pushing code. Same result,
// far less to lose if the token ever leaks.

const REPO = "pix-elle/Inspiration-Gallery";
const WORKFLOW = "transcode.yml";

export async function dispatchTranscode(itemId: string): Promise<void> {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  if (!token) {
    // Not fatal for the upload itself: the row exists and stays "processing".
    // Re-running the workflow by hand later picks it up.
    console.error(
      `GITHUB_DISPATCH_TOKEN manquant — l'item ${itemId} reste en attente d'encodage`
    );
    return;
  }

  const res = await fetch(
    `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      // The workflow lives on the default branch; ref says which copy to run.
      body: JSON.stringify({ ref: "main", inputs: { item_id: itemId } }),
    }
  );

  // 204 is the success answer here — GitHub returns no body.
  if (res.status !== 204) {
    console.error(
      `Déclenchement de l'encodage refusé (${res.status}) : ${await res.text()}`
    );
  }
}
