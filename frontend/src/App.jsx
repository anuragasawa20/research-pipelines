import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './App.css';
import Layout from './components/Layout';
import CompaniesPage from './pages/CompaniesPage';
import CompanyDetailPage from './pages/CompanyDetailPage';
import DebugPage from './pages/DebugPage';
import HomePage from './pages/HomePage';
import RunDetailPage from './pages/RunDetailPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />} path="/">
          <Route element={<HomePage />} index />
          <Route element={<RunDetailPage />} path="runs/:runId" />
          <Route element={<CompaniesPage />} path="companies" />
          <Route element={<CompanyDetailPage />} path="companies/:companyId" />
          <Route element={<DebugPage />} path="debug" />
          <Route element={<Navigate replace to="/" />} path="*" />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
