import React from "react";
import SimpleBar from "simplebar-react";
import { ListGroup, Nav, Offcanvas, Tab, Button } from "react-bootstrap";
import { Link } from "react-router-dom";

//import custom components
import Flex from "./Flex";
import {
  IconCalendarWeek,
  IconChecks,
  IconCircleFilled,
  IconSettings,
  IconShoppingCart,
} from "@tabler/icons-react";
import { Avatar } from "./Avatar";

interface NotificationProps {
  isOpen: boolean;
  onClose: () => void;
}

const NoficationList: React.FC<NotificationProps> = ({ isOpen, onClose }) => {
  return (
    <Offcanvas placement="end" show={isOpen} onHide={onClose}>
      <div className="sticky-top bg-white">
        <Offcanvas.Header className="gap-4" closeButton={true}>
          <Flex justifyContent="between" className="w-100">
            <h5 className="mb-0" id="offcanvasNotificationLabel">
              Bildirimler
            </h5>
            <Flex alignItems="center" className="gap-3">
              <Link to="#" className="link-primary">
                <IconChecks size={24} strokeWidth={1.5} />
              </Link>
              <Link to="#" className="text-inherit">
                <IconSettings size={24} strokeWidth={1.5} />
              </Link>
            </Flex>
          </Flex>
        </Offcanvas.Header>
      </div>

      {/* Tab Content Start */}
      <div className="mt-2">
        <Tab.Container defaultActiveKey={"0"}>
          <Nav className="nav-line-bottom" defaultActiveKey={"0"}>
            <Nav.Item>
              <Nav.Link role="button" eventKey={"0"}>
                Tümü
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link role="button" eventKey={"1"}>
                Takip Edilenler
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link role="button" eventKey={"2"}>
                Arşiv
              </Nav.Link>
            </Nav.Item>
          </Nav>
          <Tab.Content id="pills-tabContent">
            <Tab.Pane eventKey={"0"}>
              <SimpleBar style={{ maxHeight: 450 }}>
                <ListGroup variant="flush">
                  <ListGroup.Item
                    action
                    className="p-5 border-dashed border-bottom"
                  >
                    <div className="d-flex justify-content-between">
                      <div className="d-flex flex-column gap-1">
                        <div>Yeni sipariş oluşturuldu</div>
                        <small className="text-secondary">2 dakika önce</small>
                      </div>
                      <div>
                        <IconCircleFilled size={10} className="text-info" />
                      </div>
                    </div>
                  </ListGroup.Item>
                  <ListGroup.Item
                    action
                    className="p-5 border-dashed border-bottom"
                  >
                    <div className="d-flex justify-content-between">
                      <div className="d-flex flex-column gap-1">
                        <div>Sistem yedeklemesi tamamlandı</div>
                        <small className="text-secondary">15 dakika önce</small>
                      </div>
                      <div>
                        <IconCircleFilled size={10} className="text-info" />
                      </div>
                    </div>
                  </ListGroup.Item>
                </ListGroup>
              </SimpleBar>
            </Tab.Pane>
          </Tab.Content>
        </Tab.Container>
      </div>
      <div className="px-5 py-3 text-center bg-white position-absolute bottom-0 border-top border-dashed w-100 text-center">
        <Link to="#" className="text-inherit">
          Tümünü Gör
        </Link>
      </div>
    </Offcanvas>
  );
};

export default NoficationList;
