import { useNavigate } from 'react-router-dom';
import IiflHeader from '../components/iifl/IiflHeader';
import IiflHero, { HeroLead } from '../components/iifl/IiflHero';
import { useLead } from '../contexts/LeadContext';

const Home = () => {
    const navigate = useNavigate();
    const { setLead, clearLead } = useLead();

    // Path B — "Talk to AI": open the chat agent (collects details + FAQs,
    // then hands off to the voice call via an in-chat "Call Now" button).
    // Start fresh — the chat agent will fill the context itself.
    const openAgent = () => {
        clearLead();
        navigate('/agent/chat');
    };

    // Path A — form "Apply Now": capture the four fields into the shared lead
    // context, then jump into the live voice call page (AgentVoicePage) where the
    // AI transcript + live form-fill stream — the agent greets already knowing them.
    const startLiveCall = (lead: HeroLead) => {
        setLead({
            name: lead.name,
            phone: lead.phone,
            pincode: lead.pincode,
            loanType: lead.loanType,
        });
        navigate('/agent/voice');
    };

    return (
        <div className="min-h-screen bg-iifl-navy font-roboto">
            <IiflHeader onOpenAgent={openAgent} />
            <IiflHero onOpenAgent={openAgent} onApply={startLiveCall} />
        </div>
    );
};

export default Home;
