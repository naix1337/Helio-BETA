import NodesTable from './NodesTable';

export default function NodesView() {
  return (
    <div className="animate-[view-fade_0.35s_cubic-bezier(0.22,1,0.36,1)]">
      <NodesTable full />
    </div>
  );
}
