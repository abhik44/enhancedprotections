import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Login from "./pages/login";
import { Toaster } from "react-hot-toast";
import AppLayout from "./ui/AppLayout";

import "./index.css";

import Staff from "./pages/Staff";

import Shifts from "./pages/Shifts";
import Site from "./pages/Site";
import SiteDocuments from "./pages/SiteDocuments";
import SiteDocumentDetails from "./pages/SiteDocumentDetails";

import Document from "./pages/Document";
import ViewStaffSignedDocuments from "./pages/ViewStaffSignedDocuments";

function App() {
  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />

          <Route path="app" element={<AppLayout />}>
            <Route index element={<Navigate replace to="staff" />} />

            {/* staff route */}

            {/* shift */}
            <Route path="shift" element={<Shifts />} />

            {/* site */}
            <Route path="site" element={<Site />} />

            <Route path="site-documents" element={<SiteDocuments />} />
            <Route path="site-documents/:siteId" element={<SiteDocumentDetails />} />

            {/* document */}

            <Route path="document" element={<Document />} />

            {/* staff */}

            <Route path="staff">
              <Route index element={<Staff />} />

              {/* viewStaffSignedDocuments */}

              <Route path="viewStaffSignedDocuments" element={<ViewStaffSignedDocuments />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>

      <Toaster
        position="top-center"
        gutter={12}
        containerStyle={{ margin: "8px" }}
        toastOptions={{
          success: {
            duration: 3000,
            backgroundColor: "#4caf50",
            color: "#fff",
          },
          error: {
            duration: 3000,
            backgroundColor: "#ce0e31",
            color: "#fff",
          },
          style: {
            fontSize: "16px",
            maxWidth: "500px",
            padding: "16px 24px",
          },
        }}
      />
    </>
  );
}

export default App;
