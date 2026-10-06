import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Categories from './pages/Categories';
import Brands from './pages/Brands';
import Products from './pages/Products';
import Clients from './pages/Clients';
import Fournisseurs from './pages/Fournisseurs';
import FacturesVente from './pages/FacturesVente';
import FacturesAchat from './pages/FacturesAchat';

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-layout">
        <Sidebar />
        <main className="main-content">
          <Routes>
            <Route path="/"                 element={<Dashboard />} />
            <Route path="/categories"       element={<Categories />} />
            <Route path="/brands"           element={<Brands />} />
            <Route path="/products"         element={<Products />} />
            <Route path="/clients"          element={<Clients />} />
            <Route path="/fournisseurs"     element={<Fournisseurs />} />
            <Route path="/factures-vente"   element={<FacturesVente />} />
            <Route path="/factures-achat"   element={<FacturesAchat />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
