import { createContext, FC, ReactNode, useContext, useState } from "react";

export type InteractionMode = 'chat' | 'talk';

interface ModeContextType {
    mode: InteractionMode;
    setMode: (mode: InteractionMode) => void;
}

const ModeContext = createContext<ModeContextType | undefined>(undefined);

export type ModeProviderProps = {
    children: ReactNode;
};

export const ModeProvider: FC<ModeProviderProps> = ({ children }) => {
    // Default to 'talk' to preserve existing behavior
    const [mode, setMode] = useState<InteractionMode>('talk');

    return (
        <ModeContext.Provider value={{ mode, setMode }}>
            {children}
        </ModeContext.Provider>
    );
};

export const useMode = () => {
    const context = useContext(ModeContext);
    if (!context) {
        throw new Error("useMode must be used within a ModeProvider");
    }
    return context;
};
