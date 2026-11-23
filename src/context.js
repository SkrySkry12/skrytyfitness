import { createContext, useContext } from "react";

/**
 * App-wide data & actions:
 * { user, settings, saveSettings, entries, stats, today, tz,
 *   createEntry, updateEntry, deleteEntry, navigate, reportError }
 */
export const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);
