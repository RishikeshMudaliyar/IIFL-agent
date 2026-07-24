import { useNavigate } from 'react-router-dom';
import IiflHeader from '../components/iifl/IiflHeader';
import IiflHero from '../components/iifl/IiflHero';
import IiflFooter from '../components/iifl/IiflFooter';

const Home = () => {
    const navigate = useNavigate();

    // The AI agent entry point — the "Chat Now" launcher and header/hero CTAs
    // route into the chat/voice mode picker.
    const openAgent = () => navigate('/chat');

    return (
        <div className="min-h-screen bg-white font-roboto">
            <IiflHeader onOpenAgent={openAgent} />
            <IiflHero onOpenAgent={openAgent} />
            <IiflFooter />
        </div>
    );
};

export default Home;
