import React from 'react';
import { Modal } from 'react-bootstrap';

const PendingInvitesModal = ({ invites, onClose }) => (
    <Modal show onHide={onClose}>
        <Modal.Header closeButton>
            <Modal.Title>Pending Friend Requests</Modal.Title>
        </Modal.Header>
        <Modal.Body>
            {invites.length > 0 ? (
                invites.map(invite => <div key={invite.id}>{invite.name}</div>)
            ) : (
                <div>No pending invites</div>
            )}
        </Modal.Body>
        <Modal.Footer>
            <button onClick={onClose}>Close</button>
        </Modal.Footer>
    </Modal>
);

export default PendingInvitesModal;