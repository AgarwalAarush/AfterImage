import type { ReactNode } from 'react';
export function LibraryContent({loaded,error,retry,loading,children}: {
  loaded:boolean; error:string; retry:()=>void; loading:ReactNode; children:ReactNode;
}) {
  if (loaded) return <>
    {error && <div className="connection-notice" role="status">
      <span>Connection interrupted. Showing your last loaded library while we reconnect.</span>
      <button className="text-button" onClick={retry}>Retry now</button>
    </div>}
    {children}
  </>;
  if (error) return <div className="empty panel" role="alert">
    <h1>Your library is taking a little longer.</h1>
    <p>{error}</p>
    <button className="button" onClick={retry}>Try again</button>
  </div>;
  return <>{loading}</>;
}
