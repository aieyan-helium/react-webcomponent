/*
Copyright 2018 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

import React, { ComponentType } from "react";
import ReactDOM from "react-dom";
import { createRoot, Root } from "react-dom/client";
import { DOMModel } from "./dom-model/DOMModel";

const _rootShadows = new WeakMap();
const _models = new WeakMap();

/**
 * Generates the model for a given CustomElement
 *
 * @param   {CustomElement} component - the component to parse
 * @returns {DOMModel} - the generated model
 */
function generateModel(component: CustomElement) {
    let model: DOMModel = _models.get(component);
    const constructor = component.constructor as typeof CustomElement;
    if (!model && constructor.domModel) {
        model = new constructor.domModel(component);
        model.fromDOM(component);
        _models.set(component, model);
    }
    return model;
}

/**
 * Generates the events for a CustomElement
 *
 * @param   {CustomElement} component - the component to parse the model fromDO
 * @returns {Object} - the events object
 */
function getEvents(component: CustomElement) {
    let eventsMap: Record<string, any> = {};
    let model = _models.get(component);
    if (model) {
        let events = model.events;
        events.forEach((eventName: string) => {
            let eventFn = eventName;
            if (!eventFn.startsWith("on")) {
                if (!/[A-Z]/.test(eventFn[0])) {
                    eventFn = eventFn[0].toUpperCase() + eventFn.substr(1);
                }
                eventFn = "on" + eventFn;
            }
            eventsMap[eventFn] = function (event: any) {
                component.dispatchEvent(
                    new CustomEvent(eventName, {
                        detail: event.detail,
                        bubbles: true,
                    })
                );
            };
        });
    }

    return eventsMap;
}

/**
 * Renders a CustomElement
 *
 * @param   {CustomElement} component the component to render
 */
function renderCustomElement(component: CustomElement) {
    const constructor = component.constructor as typeof CustomElement;
    const ReactComponent = constructor.ReactComponent;
    const model = generateModel(component);
    const properties: any = model.properties;
    const events = getEvents(component);

    const reactElem = React.createElement(
        ReactComponent,
        Object.assign(properties, events),
        null
    );

    const root = createRoot(_rootShadows.get(component));

    root.render(reactElem);

    component.__reactComp = root;
}

export class CustomElement extends HTMLElement {
    __reactComp?: Root;
    static ReactComponent:
        | string
        | React.FunctionComponent<any>
        | React.ComponentClass<any, any>;
    static domModel?: any;
    rootDiv?: HTMLDivElement;
    static renderRoot?: "element" | "container" | "shadowRoot";

    connectedCallback() {
        let rootEl: any = this;
        const constructor = this.constructor as typeof CustomElement;
        switch (constructor.renderRoot) {
            case "container":
                rootEl = this.rootDiv = document.createElement("div");
                this.appendChild(rootEl);
                break;
            case "shadowRoot":
                rootEl = this.attachShadow({ mode: "closed" });
                break;
        }
        _rootShadows.set(this, rootEl);

        renderCustomElement(this);
        this.addEventListener("_updateModel", this._updateModel.bind(this));
    }

    _generateModel() {
        return generateModel(this);
    }

    _updateModel(event: any) {
        let model = _models.get(this);
        if (model) {
            let changedProperties = event.detail;
            changedProperties.forEach((property: any) => {
                model[property.propertyName] = property.value;
            });
        }
        renderCustomElement(this);
    }

    disconnectedCallback() {
        const rootEl = _rootShadows.get(this);
        if (rootEl) {
            const root = createRoot(rootEl);
            root.unmount();
        }

        if (this.rootDiv) {
            this.removeChild(this.rootDiv);
            delete this.rootDiv;
        }
        let model = _models.get(this);
        if (model) {
            model.destroy();
            _models.delete(this);
        }
    }

    attributeChangedCallback(name: string, oldValue: any, newValue: any) {
        let model = _models.get(this);
        if (model) {
            let key = model.getAttributeKey(name);
            let property = model.getProperty(key);
            model[key] = property ? property.fromDOM(this) : newValue;
            renderCustomElement(this);
        }
    }
}

export function createCustomElement<T extends DOMModel>(
    ReactComponent: React.ComponentType<any>,
    Model: new (...args: any[]) => T,
    renderRoot: "element" | "container" | "shadowRoot" = "element"
) {
    class CustomCustomElement extends CustomElement {
        static observedAttributes: any;
    }

    CustomCustomElement.domModel = Model;
    CustomCustomElement.ReactComponent = ReactComponent;
    CustomCustomElement.renderRoot = renderRoot;
    if (Model) {
        CustomCustomElement.observedAttributes = Model.prototype.attributes;
    }
    return CustomCustomElement;
}
