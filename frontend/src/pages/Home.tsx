import { useNavigate } from 'react-router-dom';
import IiflHeader from '../components/iifl/IiflHeader';
import IiflHero, { HeroLead } from '../components/iifl/IiflHero';
import { useLead } from '../contexts/LeadContext';

const Home = () => {
    const navigate = useNavigate();
    const { setLead } = useLead();

    // Single path — form "Talk to AI Agent": capture the four fields into the
    // shared lead context, then go to the call page which triggers an OUTBOUND
    // phone call from the AI agent to the number entered here. The agent greets
    // the caller already knowing them (context passed as dynamic variables).
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
            <IiflHeader />
            <IiflHero onApply={startLiveCall} />
        </div>
    );
};

export default Home;
