import { Outlet, createFileRoute, notFound } from "@tanstack/react-router";
import { Shell } from "../../directions/shell";
import { DirProvider, isDirection } from "../../lib/dir";
import { MoodProvider } from "../../lib/mood";

export const Route = createFileRoute("/$dir")({
  beforeLoad: ({ params }) => {
    if (!isDirection(params.dir)) throw notFound();
  },
  component: function DirectionLayout() {
    const { dir } = Route.useParams();
    if (!isDirection(dir)) return null;
    return (
      <DirProvider dir={dir}>
        <MoodProvider>
          <Shell>
            <Outlet />
          </Shell>
        </MoodProvider>
      </DirProvider>
    );
  },
});
