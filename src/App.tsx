import { Routes, Route, Navigate } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { JobList } from "./components/JobList";
import { JobView } from "./components/JobView";
import { CameraCapture } from "./components/CameraCapture";
import { DescribeCircuit } from "./components/DescribeCircuit";

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<JobList />} />
        <Route path="/job/:jobId" element={<JobView />} />
        <Route path="/job/:jobId/capture" element={<CameraCapture />} />
        <Route path="/job/:jobId/describe" element={<DescribeCircuit />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}
