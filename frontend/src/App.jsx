import DashboardLayout from './components/DashboardLayout';
import UploadSidebar from './components/UploadSidebar';
import UploadChart from './components/UploadChart';

export default function App() {
  return (
    <DashboardLayout sidebar={<UploadSidebar />}>
      <UploadChart />
    </DashboardLayout>
  );
}
