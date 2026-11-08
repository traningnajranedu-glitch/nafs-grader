import DownloadStatsPanel from './download-stats-panel';
export default function IndividualResultsLayout({children}:{children:React.ReactNode}){
 return <><div style={{maxWidth:1216,margin:'0 auto',padding:'24px 0 0'}}><DownloadStatsPanel/></div>{children}</>;
}
