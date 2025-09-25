import axios from 'axios';

export const checkPendingInvites = async (userId: string) => {
    const response = await axios.get(`/api/invites/pending/${userId}`);
    return response.data;
};

// Additional API methods for the unified invite system can be added here.