import { RouterProvider } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { SidebarProvider } from './context/SidebarContext';
import { AuthProvider } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { GlobalAlertProvider } from './context/GlobalAlertContext';
import { router } from './routes';

export default function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <ThemeProvider>
          <SidebarProvider>
            <GlobalAlertProvider>
              <RouterProvider router={router} />
            </GlobalAlertProvider>
          </SidebarProvider>
        </ThemeProvider>
      </DataProvider>
    </AuthProvider>
  );
}
