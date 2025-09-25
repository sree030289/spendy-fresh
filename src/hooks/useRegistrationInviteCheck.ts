import { useEffect, useState } from 'react';
import { checkPendingInvites } from '../services/api/ApiServiceExtensions';

const useRegistrationInviteCheck = (userId: string) => {
    const [pendingInvites, setPendingInvites] = useState([]);

    useEffect(() => {
        const fetchPendingInvites = async () => {
            const invites = await checkPendingInvites(userId);
            setPendingInvites(invites);
        };
        fetchPendingInvites();
    }, [userId]);

    return pendingInvites;
};

export default useRegistrationInviteCheck;