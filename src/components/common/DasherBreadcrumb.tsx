import React from "react";
import { Container, Row, Col, Breadcrumb } from "react-bootstrap";
import { useLocation, useNavigate } from "react-router-dom";
import { capitalizedWord } from "helper/utils";

const DasherBreadcrumb: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const pathSegments = location.pathname.split("/").filter((segment) => segment !== "");

  return (
    <div className="mt-4">
      <Container>
        <Row>
          <Col>
            <Breadcrumb className="mb-0">
              <Breadcrumb.Item onClick={() => navigate("/")}>
                Ana Sayfa
              </Breadcrumb.Item>
              {pathSegments.map((segment, index) =>
                index === pathSegments.length - 1 ? (
                  <Breadcrumb.Item
                    as="li"
                    active
                    key={segment}
                    className="text-capitalize"
                  >
                    {capitalizedWord(segment)}
                  </Breadcrumb.Item>
                ) : (
                  <Breadcrumb.Item as="li" key={segment}>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={() =>
                        navigate(
                          `/${pathSegments.slice(0, index + 1).join("/")}`
                        )
                      }
                    >
                      {capitalizedWord(segment)}
                    </span>
                  </Breadcrumb.Item>
                )
              )}
            </Breadcrumb>
          </Col>
        </Row>
      </Container>
    </div>
  );
};

export default DasherBreadcrumb;
