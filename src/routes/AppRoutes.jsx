// Configuração das rotas principais do sistema do carrinho

import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "../pages/Home";

function AppRoutes() {
  return (
    <BrowserRouter>
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
        </Routes>
      </Router>
    </BrowserRouter>
  );
}

export default AppRoutes;
